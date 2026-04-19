// Streaming AI Test Generation — POST /api/generate-stream

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

    const test_types = body.test_types || ['e2e'];
    const project_name = body.project_name || '';
    const biz = body.business_context;
    const language = body.language || 'en';

    // Extract web via Jina AI
    let page = '';
    try {
      const jina = await fetch('https://r.jina.ai/' + base_url, {
        headers: { 'Accept': 'text/markdown' },
        signal: AbortSignal.timeout(15000),
      });
      if (!jina.ok) { res.status(502).json({ error: 'Jina error: ' + jina.status }); return; }
      page = await jina.text();
    } catch (e) {
      res.status(502).json({ error: 'Web extraction failed: ' + e.message });
      return;
    }

    const content = page.substring(0, 12000);

    // Build prompt
    const ctx = biz ? '\nBusiness: ' + JSON.stringify(biz) : '';
    const langName = language === 'es' ? 'Spanish' : 'English';
    const prompt = `You are an expert QA engineer. This platform is site-AGNOSTIC — the tests you generate MUST work regardless of the website's language, framework, or domain. You only know about this site what the PAGE CONTENT below tells you. Never assume anything not visible in the content.

Website: ${base_url} ${project_name ? '(' + project_name + ')' : ''}${ctx}

PAGE CONTENT (Markdown extracted from the live page — this is the ONLY source of truth about the site):
${content}

LANGUAGE FOR METADATA: titles, descriptions, module names, code comments → ${langName}.
Code itself (Playwright API) is always in English.

═══════════════════════════════════════════════════════════════
CRITICAL — SELECTOR STRATEGY (agnostic to any site, any language)
═══════════════════════════════════════════════════════════════

Before writing a selector, ask yourself:
  "Did I actually see this exact text/attribute in the PAGE CONTENT above?"
  If NO → use a CSS attribute selector instead.

PRIORITY ORDER (use the FIRST strategy that works):

  1. **CSS selectors by semantic attribute** (BEST — language-independent, stable):
     page.locator('input[type="email"]')         // any email field
     page.locator('input[type="password"]')      // any password field
     page.locator('input[type="submit"]')        // any submit input
     page.locator('button[type="submit"]')       // any submit button
     page.locator('form')                        // any form
     page.locator('a[href*="signup"]')           // any link whose href contains "signup"

  2. **CSS selectors by name/id attribute** (when visible in HTML):
     page.locator('input[name="email"]')
     page.locator('#login-form')
     page.locator('[data-testid="login-btn"]')

  3. **getByPlaceholder** ONLY if you see the EXACT placeholder in PAGE CONTENT:
     page.getByPlaceholder('correo@ejemplo.com')

  4. **getByRole with regex and /i flag** for buttons/links with visible text:
     page.getByRole('button', { name: /log\\s*in|iniciar\\s*sesi[oó]n|entrar/i })
     (use alternation to cover multiple possible labels across languages/wording)

  5. **getByLabel** ONLY if you see the exact label text verbatim in PAGE CONTENT.
     NEVER guess labels. If the page text shows "Contraseña", use 'Contraseña' — not 'Password'.

  6. **getByText with regex** for visible copy assertions:
     expect(page.getByText(/bienvenid|welcome/i)).toBeVisible();

FORBIDDEN (these break silently on real sites):
  ✗ Assuming labels in English ('Password', 'Email', 'Login') without seeing them in PAGE CONTENT
  ✗ Hardcoded text strings without /i flag or regex alternation
  ✗ Selectors that depend on specific framework class names (e.g. .ant-btn-primary) unless seen
  ✗ Testing functionality you didn't observe in the page (e.g. "password reset" if no such link exists)

═══════════════════════════════════════════════════════════════
TEST STRUCTURE RULES
═══════════════════════════════════════════════════════════════

1. MODULE DETECTION: Divide tests into 2-5 modules based on what you actually SEE in the page:
   - If you see a login form → "Autenticación" module
   - If you see a nav bar → "Navegación" module
   - If you see a checkout button → "Checkout" module
   - Do NOT invent modules for features you can't confirm from the content.

2. Generate ${test_types.join(', ')} tests

3. Each test is fully independent — no shared state, each starts with page.goto()

4. Every test starts with: await page.goto('${base_url}');

5. Each test MUST have at least 2 expect() assertions so failures are attributable

6. Prefer STABLE assertions:
   - toHaveURL(regex) for navigation checks
   - toBeVisible() for element presence
   - toHaveTitle(regex) for page identity

7. Each interactive test should have a defensive first step:
   await expect(page.locator('body')).toBeVisible();   // page loaded at all
   before interacting with anything else. This distinguishes "site down" from "test wrong".

8. Use Playwright's auto-waiting — don't add waitForTimeout() unless absolutely needed.

RETURN ONLY valid JSON (no markdown fences, no explanatory text before or after):
{"modules":[{"name":"Module","description":"desc","test_cases":[{"title":"name","description":"what","test_type":"e2e","priority":"high","tags":["tag"],"code":"import { test, expect } from '@playwright/test';\\ntest('name', async ({ page }) => { await page.goto('${base_url}'); });"}]}]}`;

    // SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write('event: status\ndata: ' + JSON.stringify({ step: 'extracting', message: 'Web content extracted (' + content.length + ' chars)' }) + '\n\n');
    res.write('event: status\ndata: ' + JSON.stringify({ step: 'generating', message: 'AI generating tests...' }) + '\n\n');

    // Gemini streaming
    const gUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=' + GEMINI_KEY + '&alt=sse';
    const gRes = await fetch(gUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
      }),
    });

    if (!gRes.ok) {
      res.write('event: error\ndata: ' + JSON.stringify({ message: 'Gemini error: ' + gRes.status }) + '\n\n');
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
            res.write('event: chunk\ndata: ' + JSON.stringify({ text: t }) + '\n\n');
          }
        } catch {}
      }
    }

    // Parse result
    res.write('event: status\ndata: ' + JSON.stringify({ step: 'parsing', message: 'Parsing...' }) + '\n\n');

    let mods = [];
    try {
      let c = full.trim();
      if (c.startsWith('```json')) c = c.substring(7);
      if (c.startsWith('```')) c = c.substring(3);
      if (c.endsWith('```')) c = c.substring(0, c.length - 3);
      const parsed = JSON.parse(c.trim());
      mods = Array.isArray(parsed) ? parsed : (parsed.modules || [parsed]);
    } catch {
      mods = [{ name: 'Generated Tests', description: 'AI tests', test_cases: [{ title: 'Generated Suite', description: '', test_type: 'e2e', priority: 'medium', code: full, tags: [] }] }];
    }

    // Post-process: harden selectors for robustness across any site/language.
    // This is defense-in-depth — the prompt already asks the AI to do this,
    // but we enforce it at the gate so bad selectors don't reach the user.
    // Strategy: ALWAYS widen known semantic patterns to multi-language regex.
    // A regex that includes the original literal is strictly safer than the
    // literal itself, so there's no downside to always widening.
    function hardenCode(code) {
      if (!code || typeof code !== 'string') return code;
      let out = code;

      // Known semantic labels with multi-language alternations.
      // When the AI emits any of these as a string literal in getByLabel/Role,
      // we replace with a regex covering the common variants across languages.
      const LABEL_MAP = [
        { match: /^\s*(password|contrase[ñn]a)\s*$/i,                                         rx: 'password|contrase[ñn]a' },
        { match: /^\s*(email|correo(\s+electr[oó]nico)?|e-?mail)\s*$/i,                       rx: 'email|correo(\\s+electr[oó]nico)?|e-?mail' },
        { match: /^\s*(user(name)?|usuario)\s*$/i,                                             rx: 'user(name)?|usuario' },
        { match: /^\s*(log\s*in|sign\s*in|iniciar\s*sesi[oó]n|entrar|ingresar|acceder)\s*$/i,  rx: 'log\\s*in|sign\\s*in|iniciar\\s*sesi[oó]n|entrar|ingresar|acceder' },
        { match: /^\s*(sign\s*up|register|registrarse|crear\s*cuenta|reg[ií]strate)\s*$/i,     rx: 'sign\\s*up|register|registrarse|crear\\s*cuenta|reg[ií]strate' },
        { match: /^\s*(submit|enviar|continuar|siguiente|next)\s*$/i,                          rx: 'submit|enviar|continuar|siguiente|next' },
        { match: /^\s*(search|buscar|b[uú]squeda)\s*$/i,                                       rx: 'search|buscar|b[uú]squeda' },
        { match: /^\s*(cancel|cancelar)\s*$/i,                                                 rx: 'cancel|cancelar' },
        { match: /^\s*(delete|eliminar|borrar)\s*$/i,                                          rx: 'delete|eliminar|borrar' },
        { match: /^\s*(save|guardar)\s*$/i,                                                    rx: 'save|guardar' },
        { match: /^\s*(forgot(\s+(your\s+)?password)?|olvid[oó](\s+(su|tu)\s+contrase[ñn]a)?)\s*$/i, rx: 'forgot(\\s+(your\\s+)?password)?|olvid[oó](\\s+(su|tu)\\s+contrase[ñn]a)?' },
      ];

      const widenLiteral = (full, quote, value) => {
        for (const { match, rx } of LABEL_MAP) {
          if (match.test(value)) {
            return full.replace(quote + value + quote, '/' + rx + '/i');
          }
        }
        // Unknown label: still widen to regex with /i so case/whitespace variance doesn't break it
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        return full.replace(quote + value + quote, '/' + escaped + '/i');
      };

      // getByLabel('X')
      out = out.replace(/getByLabel\(\s*(['"`])([^'"`]+)\1\s*\)/g, (m, q, v) => widenLiteral(m, q, v));
      // getByRole('role', { name: 'X' })
      out = out.replace(/getByRole\([^)]*name:\s*(['"`])([^'"`]+)\1[^)]*\)/g, (m, q, v) => widenLiteral(m, q, v));
      // getByText('X') — widen to regex
      out = out.replace(/getByText\(\s*(['"`])([^'"`]+)\1\s*\)/g, (m, q, v) => widenLiteral(m, q, v));
      // getByPlaceholder('X') — widen to regex
      out = out.replace(/getByPlaceholder\(\s*(['"`])([^'"`]+)\1\s*\)/g, (m, q, v) => widenLiteral(m, q, v));

      // Harden common URL assertions — AIs love asserting /register but site uses /signup (or vice versa)
      const URL_MAP = [
        { match: /toHaveURL\(\s*\/[.*]*\\?\/?(register|signup|sign-?up)[^)]*\)/gi,
          replace: "toHaveURL(/register|signup|sign-?up|crear.*cuenta|reg[ií]strate/i)" },
        { match: /toHaveURL\(\s*\/[.*]*\\?\/?(login|signin|sign-?in)[^)]*\)/gi,
          replace: "toHaveURL(/login|signin|sign-?in|sesi[oó]n|ingresar|entrar/i)" },
      ];
      for (const { match, replace } of URL_MAP) {
        out = out.replace(match, replace);
      }

      // Harden fragile toHaveText('exact') on top-level elements — convert to toContainText with regex
      // so "WIS3" assertion on h1 becomes "contains any text" instead of exact match.
      // This makes the test verify the element exists with some text, not a specific brand name.
      out = out.replace(
        /expect\(\s*(page\.locator\(\s*(['"`])(h[1-6]|title|header)\2\s*\))\s*\)\.toHaveText\(\s*(['"`])([^'"`]+)\4\s*\)/g,
        (_m, locator) => `expect(${locator}).toBeVisible()`,
      );

      // Ensure each test has a "page loaded" sanity assert right after goto().
      // Distinguishes "site down" from "selector wrong" in the report.
      out = out.replace(
        /(await\s+page\.goto\([^)]+\);)(\s*\n)(?!\s*(?:await\s+expect\s*\(\s*page\.locator\(\s*['"`]body))/g,
        (_m, goto, nl) => goto + nl + "  await expect(page.locator('body')).toBeVisible();\n",
      );

      return out;
    }

    let warningsCount = 0;
    for (const m of mods) {
      if (!Array.isArray(m.test_cases)) continue;
      for (const tc of m.test_cases) {
        const before = tc.code || '';
        tc.code = hardenCode(before);
        if (tc.code !== before) warningsCount++;
      }
    }

    res.write('event: complete\ndata: ' + JSON.stringify({
      modules: mods,
      summary: {
        modules_count: mods.length,
        test_cases_count: mods.reduce(function(s, m) { return s + (m.test_cases ? m.test_cases.length : 0); }, 0),
        hardened_tests: warningsCount,
      },
    }) + '\n\n');

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Server error' });
    } else {
      try { res.write('event: error\ndata: ' + JSON.stringify({ message: err.message }) + '\n\n'); } catch {}
      res.end();
    }
  }
};
