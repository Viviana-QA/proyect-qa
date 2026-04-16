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
    const prompt = `You are an expert QA engineer. Analyze this web page and generate Playwright test cases.

Website: ${base_url} ${project_name ? '(' + project_name + ')' : ''}${ctx}

PAGE CONTENT (Markdown):
${content}

INSTRUCTIONS:
1. Divide into logical modules
2. Generate ${test_types.join(', ')} tests using Playwright
3. Use getByRole, getByLabel, getByText selectors
4. Each test must be independent

RETURN ONLY valid JSON (no markdown fences):
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

    res.write('event: complete\ndata: ' + JSON.stringify({
      modules: mods,
      summary: { modules_count: mods.length, test_cases_count: mods.reduce(function(s, m) { return s + (m.test_cases ? m.test_cases.length : 0); }, 0) },
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
