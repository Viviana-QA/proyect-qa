/**
 * Streaming AI Test Generation Endpoint
 * 
 * This is a standalone Vercel Function (NOT part of NestJS) that:
 * 1. Validates the Supabase JWT
 * 2. Extracts the web page content via Jina AI Reader
 * 3. Streams Gemini's response directly to the frontend
 * 
 * Deployed at: /api/generate-stream
 * Method: POST
 * Body: { project_id, base_url, test_types[], project_name?, business_context? }
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing authorization' });
      return;
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.substring(7)
    );
    if (authError || !user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const { base_url, test_types = ['e2e'], project_name, business_context } = req.body;
    if (!base_url) {
      res.status(400).json({ error: 'base_url is required' });
      return;
    }

    // 2. Extract web content via Jina AI Reader (free, no API key needed)
    const jinaUrl = `https://r.jina.ai/${base_url}`;
    const jinaResponse = await fetch(jinaUrl, {
      headers: {
        'Accept': 'text/markdown',
        'X-Return-Format': 'markdown',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!jinaResponse.ok) {
      res.status(502).json({ 
        error: 'Failed to extract web content',
        detail: `Jina returned ${jinaResponse.status}` 
      });
      return;
    }

    const pageContent = await jinaResponse.text();
    const truncatedContent = pageContent.substring(0, 12000); // Keep under token limits

    // 3. Build the Gemini prompt
    const prompt = buildPrompt(truncatedContent, base_url, test_types, project_name, business_context);

    // 4. Stream Gemini response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial event
    sendSSE(res, 'status', { step: 'extracting', message: 'Web content extracted successfully' });
    sendSSE(res, 'status', { step: 'generating', message: 'AI is generating test cases...' });

    // Call Gemini streaming API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.text();
      sendSSE(res, 'error', { message: `Gemini API error: ${geminiResponse.status}` });
      res.end();
      return;
    }

    // Read the SSE stream from Gemini and forward chunks to client
    const reader = geminiResponse.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events from Gemini
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6).trim();
          if (jsonStr === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
              sendSSE(res, 'chunk', { text });
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    // 5. Parse the completed response and send final event
    sendSSE(res, 'status', { step: 'parsing', message: 'Parsing generated tests...' });
    
    let parsedModules = [];
    try {
      parsedModules = parseGeneratedTests(fullText);
    } catch (parseErr) {
      // If JSON parsing fails, send the raw text as a single module
      parsedModules = [{
        name: 'Generated Tests',
        description: 'AI-generated test cases',
        test_cases: [{
          title: 'Generated Test Suite',
          description: 'Tests generated by AI',
          test_type: 'e2e',
          priority: 'medium',
          code: fullText,
          tags: [],
        }],
      }];
    }

    sendSSE(res, 'complete', {
      modules: parsedModules,
      summary: {
        modules_count: parsedModules.length,
        test_cases_count: parsedModules.reduce((sum, m) => sum + (m.test_cases?.length || 0), 0),
      },
    });
    
    res.end();

  } catch (err) {
    try {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      } else {
        sendSSE(res, 'error', { message: err.message });
        res.end();
      }
    } catch {
      res.end();
    }
  }
};

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function buildPrompt(pageContent, baseUrl, testTypes, projectName, businessContext) {
  const typesStr = testTypes.join(', ');
  const contextStr = businessContext 
    ? `\nBusiness Context: ${JSON.stringify(businessContext)}`
    : '';

  return `You are an expert QA automation engineer. Analyze the following web page and generate Playwright test cases.

Website: ${baseUrl}${projectName ? ` (${projectName})` : ''}${contextStr}

PAGE CONTENT (extracted as Markdown):
${pageContent}

INSTRUCTIONS:
1. Analyze the page structure, navigation, forms, interactive elements, and content
2. Divide the application into logical modules (e.g., "Authentication", "Navigation", "Forms", "Content Display")
3. For each module, generate ${typesStr} test cases using Playwright
4. Use accessible selectors: getByRole, getByLabel, getByText, getByPlaceholder
5. Each test must be self-contained and independent

RETURN FORMAT (JSON):
{
  "modules": [
    {
      "name": "Module Name",
      "description": "What this module covers",
      "test_cases": [
        {
          "title": "descriptive test name",
          "description": "what this test validates",
          "test_type": "e2e",
          "priority": "high",
          "tags": ["login", "auth"],
          "code": "import { test, expect } from '@playwright/test';\\n\\ntest('test name', async ({ page }) => {\\n  await page.goto('${baseUrl}');\\n  // test steps\\n});"
        }
      ]
    }
  ]
}

Generate comprehensive, production-ready test cases. Return ONLY valid JSON.`;
}

function parseGeneratedTests(text) {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  cleaned = cleaned.trim();

  const parsed = JSON.parse(cleaned);
  return Array.isArray(parsed) ? parsed : (parsed.modules || [parsed]);
}
