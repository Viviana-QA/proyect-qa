// Site Exploration — POST /api/explore-stream
// Crawls the site (up to 8 pages), aggregates content, and asks the AI
// for a structured site map with modules, flows, and suggested assertions.
// Returns SSE events so the UI can show real-time progress.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') {
    res.json({ info: 'Use POST', node: process.version });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;

  try {
    // Auth check
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }
    const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { 'Authorization': auth, 'apikey': SUPABASE_KEY },
    });
    if (!userRes.ok) { res.status(401).json({ error: 'Invalid token' }); return; }

    const body = req.body || {};
    const base_url = body.base_url;
    if (!base_url) { res.status(400).json({ error: 'base_url required' }); return; }

    const project_name = body.project_name || '';
    const biz = body.business_context;
    const language = body.language || 'en';
    const max_pages = Math.min(parseInt(body.max_pages || '12', 10), 20);
    // URLs explicitly provided by the user — guaranteed to be crawled in
    // addition to anything we auto-discover from the home page.
    const additional_urls = Array.isArray(body.additional_urls) ? body.additional_urls : [];
    // Auth-protected site hint — tells the AI that many pages won't be
    // scrape-visible so it should propose flows based on key_flows too.
    const requires_auth = Boolean(body.requires_auth);

    // Set up SSE early so events can flow
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (event, data) => {
      res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
    };

    // ───────────────────────────────────────────────────────────────
    // Step 1: Scrape the home page via Jina
    // ───────────────────────────────────────────────────────────────
    send('status', { step: 'scraping_home', message: 'Analizando página principal...' });

    const jinaFetch = async (url) => {
      const r = await fetch('https://r.jina.ai/' + url, {
        headers: { 'Accept': 'text/markdown' },
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error('Jina ' + r.status + ' for ' + url);
      return await r.text();
    };

    let homeContent = '';
    try {
      homeContent = await jinaFetch(base_url);
    } catch (e) {
      send('error', { message: 'No se pudo acceder a la página principal: ' + e.message });
      res.end();
      return;
    }

    send('status', { step: 'home_scraped', message: 'Página principal cargada (' + homeContent.length + ' chars)' });

    // ───────────────────────────────────────────────────────────────
    // Step 2: Extract internal links from the home page markdown
    // ───────────────────────────────────────────────────────────────
    const baseUrlObj = new URL(base_url);
    const baseHost = baseUrlObj.host;

    // Match Markdown [text](url) links and raw https URLs
    const urlSet = new Set();
    const mdLinkRe = /\[[^\]]*\]\(([^)]+)\)/g;
    const rawUrlRe = /https?:\/\/[^\s<>"')]+/g;
    let m;
    while ((m = mdLinkRe.exec(homeContent)) !== null) {
      try {
        const u = new URL(m[1], base_url);
        if (u.host === baseHost) urlSet.add(u.origin + u.pathname);
      } catch { /* bad URL */ }
    }
    while ((m = rawUrlRe.exec(homeContent)) !== null) {
      try {
        const u = new URL(m[0]);
        if (u.host === baseHost) urlSet.add(u.origin + u.pathname);
      } catch { /* bad URL */ }
    }
    urlSet.delete(baseUrlObj.origin + baseUrlObj.pathname); // don't re-scrape home

    // Merge user-provided URLs with auto-discovered ones — user URLs go first
    // so they're guaranteed to be crawled within the max_pages budget.
    const discovered = Array.from(urlSet);
    const priorityKeywords = ['signin', 'signup', 'login', 'register', 'dashboard', 'catalog', 'catalogue', 'product', 'checkout', 'cart', 'account', 'profile', 'settings', 'orders', 'quotes', 'requests', 'invoic'];
    discovered.sort((a, b) => {
      const aScore = priorityKeywords.some((k) => a.toLowerCase().includes(k)) ? 0 : 1;
      const bScore = priorityKeywords.some((k) => b.toLowerCase().includes(k)) ? 0 : 1;
      return aScore - bScore;
    });

    // Normalize user URLs so comparison is stable
    const normalizeUrl = (u) => {
      try {
        const n = new URL(u, base_url);
        return n.origin + n.pathname;
      } catch { return null; }
    };
    const userUrls = additional_urls
      .map(normalizeUrl)
      .filter(Boolean)
      .filter((u) => u !== baseUrlObj.origin + baseUrlObj.pathname);
    // De-dup while preserving user-first order
    const seen = new Set();
    const ordered = [];
    for (const u of [...userUrls, ...discovered]) {
      if (seen.has(u)) continue;
      seen.add(u);
      ordered.push(u);
    }
    const toVisit = ordered.slice(0, max_pages - 1);

    send('links_found', {
      total: discovered.length,
      user_provided: userUrls.length,
      to_visit: toVisit,
    });

    // ───────────────────────────────────────────────────────────────
    // Step 3: Scrape each discovered URL (with a concurrency cap)
    // ───────────────────────────────────────────────────────────────
    const pages = [{ url: base_url, content: homeContent.substring(0, 4000) }];

    // Process in parallel batches of 3 to respect Jina rate limits and Vercel 60s ceiling
    const batchSize = 3;
    for (let i = 0; i < toVisit.length; i += batchSize) {
      const batch = toVisit.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (url) => {
          send('page_start', { url });
          try {
            const c = await jinaFetch(url);
            const truncated = c.substring(0, 4000);
            send('page_done', { url, chars: truncated.length });
            return { url, content: truncated };
          } catch (e) {
            send('page_failed', { url, error: e.message });
            return null;
          }
        }),
      );
      for (const r of results) if (r) pages.push(r);
    }

    send('status', { step: 'pages_scraped', count: pages.length, message: pages.length + ' páginas analizadas' });

    // ───────────────────────────────────────────────────────────────
    // Step 4: Send combined content to Gemini for structure analysis
    // ───────────────────────────────────────────────────────────────
    send('status', { step: 'analyzing', message: 'IA analizando estructura del sitio...' });

    const langName = language === 'es' ? 'Spanish' : 'English';
    const ctx = biz ? '\nBusiness context (VERY IMPORTANT — use to expand coverage beyond what is visible): ' + JSON.stringify(biz) : '';

    const combinedContent = pages
      .map((p, i) => '=== PAGE ' + (i + 1) + ': ' + p.url + ' ===\n' + p.content)
      .join('\n\n');

    const authHint = requires_auth
      ? '\n\n⚠️ AUTH-PROTECTED SITE: Most pages require login and are NOT visible in the scraped content above. You can ONLY see the public pages (landing, login, signup). However, the user already provided the expected functionality in business_context.key_flows. For those auth-protected flows:\n' +
        '  - Create modules for them based on key_flows (e.g. if key_flows mentions "checkout", create a Checkout module)\n' +
        '  - For each flow, mark entry_url as the login URL, with a note in description that authentication is required first\n' +
        '  - Use generic CSS selectors (input[type="..."], button[type="submit"]) since you cannot observe the exact labels\n' +
        '  - Prefer navigation assertions (toHaveURL with regex) and structural assertions (toBeVisible on common selectors)\n'
      : '';

    const prompt = `You are an expert QA architect. Analyze this multi-page website dump and produce a structured site map of modules, user flows, and suggested test assertions.

Website: ${base_url} ${project_name ? '(' + project_name + ')' : ''}${ctx}

${pages.length} PAGES SCRAPED (only public-facing pages visible to the crawler):
${combinedContent.substring(0, 30000)}${authHint}

METADATA LANGUAGE: ${langName}. (titles, descriptions, assertion descriptions — all in ${langName})
CODE LANGUAGE: Playwright API calls always in English.

TASK:
1. Identify 3-8 LOGICAL MODULES. Combine:
   - What you DIRECTLY OBSERVE in the scraped pages (e.g. a login form → "Autenticación", a product list → "Catálogo")
   - What business_context.key_flows suggests should exist (e.g. "checkout", "profile creation", "product listing" → create those modules even if not visible)
   Every module must map to something concrete: either observed in content OR mentioned in key_flows.

2. For each module, list URLs. If the module is auth-protected, mark urls as [] and set entry_url per flow to the login URL.

3. For each module, propose 2-5 USER FLOWS covering both happy paths AND edge cases (validation errors, empty states, invalid inputs).

4. For each flow, propose 2-4 SUGGESTED ASSERTIONS. Each assertion:
   - Has a short human description (${langName})
   - Has a playwright code snippet using SELECTOR STRATEGY below
   - Focuses on OBSERVABLE STATE (URL, visible elements, text content) rather than business logic the AI can't verify

SELECTOR STRATEGY (mandatory — tests must be site-agnostic):
  1. CSS semantic: input[type="email"], input[type="password"], button[type="submit"], form
  2. CSS by name/id: input[name="..."], #id, [data-testid="..."]
  3. getByPlaceholder('exact text seen in page')
  4. getByRole('button', { name: /regex|with|alternations/i })
  5. getByLabel(/regex/i) — only if label text is observable
  6. NEVER hardcode English labels on a non-English page

Preferred assertion patterns (stable across any site):
  - await expect(page.locator('body')).toBeVisible()         // page loaded
  - await expect(page).toHaveURL(/regex/i)                   // navigation
  - await expect(page.locator('selector')).toBeVisible()     // element present
  - await expect(page.getByText(/regex/i)).toBeVisible()     // copy visible

RETURN ONLY valid JSON (no markdown fences, no prose):
{
  "site_summary": "1-2 sentence overview of what the site does, in ${langName}",
  "detected_language": "es" | "en" | "other",
  "modules": [
    {
      "id": "mod_auth",
      "name": "Module name in ${langName}",
      "description": "What this module covers, in ${langName}",
      "urls": ["url1", "url2"],
      "flows": [
        {
          "id": "flow_login_happy",
          "name": "Flow name in ${langName}",
          "description": "1 sentence in ${langName}",
          "priority": "high|medium|low",
          "entry_url": "${base_url}",
          "suggested_assertions": [
            {
              "id": "a1",
              "description": "Description in ${langName}",
              "code": "await expect(page.locator('input[type=\\"email\\"]')).toBeVisible();"
            }
          ]
        }
      ]
    }
  ]
}`;

    const gUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=' + GEMINI_KEY + '&alt=sse';
    const gRes = await fetch(gUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
      }),
    });

    if (!gRes.ok) {
      send('error', { message: 'Gemini error: ' + gRes.status });
      res.end();
      return;
    }

    const reader = gRes.body.getReader();
    const dec = new TextDecoder();
    let full = '';
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const ln of lines) {
        if (!ln.startsWith('data: ')) continue;
        const j = ln.substring(6).trim();
        if (j === '[DONE]') continue;
        try {
          const p = JSON.parse(j);
          const t = p?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (t) {
            full += t;
            send('chunk', { text: t });
          }
        } catch {}
      }
    }

    // Parse structure
    send('status', { step: 'parsing', message: 'Finalizando estructura...' });

    /**
     * LLMs frequently emit raw backslashes inside JSON string values
     * (e.g. regex like /log\s*in/i), which violates JSON escape rules.
     * This repairs those cases by doubling any \ not followed by a
     * JSON-valid escape char ("\/bfnrtu]).
     *
     * Also handles:
     *  - Stripping control chars from strings (which some LLMs emit)
     *  - Extracting the JSON object/array even when wrapped in prose
     */
    const repairJson = (raw) => {
      let s = raw.trim();
      // Strip markdown code fences
      s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
      // Extract from { ... } if there's prose around it
      const firstBrace = s.indexOf('{');
      const lastBrace = s.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        s = s.substring(firstBrace, lastBrace + 1);
      }
      // Repair: escape lone backslashes (\s, \d, \w, \[, \., etc. → \\s, \\d, ...)
      s = s.replace(/\\(?!["\\\/bfnrtu])/g, '\\\\');
      // Strip raw control characters (except \n, \r, \t which are valid escapes inside strings)
      // LLMs sometimes emit literal control chars that break JSON.
      s = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
      return s;
    };

    let structure = null;
    let parseError = null;
    try {
      structure = JSON.parse(repairJson(full));
    } catch (e1) {
      parseError = e1;
      // Last-resort: try very aggressive trailing-comma removal
      try {
        const s = repairJson(full).replace(/,(\s*[}\]])/g, '$1');
        structure = JSON.parse(s);
        parseError = null;
      } catch (e2) {
        parseError = e2;
      }
    }

    if (!structure) {
      send('error', {
        message: 'No se pudo parsear la estructura: ' + (parseError ? parseError.message : 'unknown'),
        raw: full.substring(0, 500),
      });
      res.end();
      return;
    }

    send('complete', {
      structure: structure,
      pages_scraped: pages.length,
      urls_discovered: discovered.length,
      urls_user_provided: userUrls.length,
    });

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Server error' });
    } else {
      try {
        res.write('event: error\ndata: ' + JSON.stringify({ message: err.message }) + '\n\n');
      } catch {}
      res.end();
    }
  }
};
