import { chromium } from '@playwright/test';
import type { PageAnalysis } from '@qa/shared-types';

export async function crawlPage(url: string): Promise<PageAnalysis> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Track API calls
    const apiEndpoints: { method: string; url: string }[] = [];
    page.on('request', (req) => {
      const reqUrl = req.url();
      if (
        reqUrl.includes('/api/') ||
        reqUrl.includes('/graphql') ||
        req.resourceType() === 'fetch' ||
        req.resourceType() === 'xhr'
      ) {
        apiEndpoints.push({ method: req.method(), url: reqUrl });
      }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // page.evaluate runs in the browser context - returns serializable data
    const analysis: any = await page.evaluate(() => {
      /* eslint-disable no-undef */
      const title = document.title;
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute('content') || null;

      const headings: any[] = [];
      document.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((h: any) => {
        headings.push({
          level: parseInt(h.tagName[1]),
          text: (h.textContent || '').trim().substring(0, 100),
        });
      });

      const interactive: any[] = [];
      const sels = 'a,button,input,select,textarea,[role="button"],[role="link"],[onclick]';
      document.querySelectorAll(sels).forEach((el: any, i: number) => {
        if (i >= 100) return;
        interactive.push({
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || undefined,
          role: el.getAttribute('role') || undefined,
          text: (el.textContent || '').trim().substring(0, 80) || undefined,
          label: el.getAttribute('aria-label') || undefined,
          placeholder: el.getAttribute('placeholder') || undefined,
          name: el.getAttribute('name') || undefined,
          id: el.id || undefined,
          selector: el.id ? `#${el.id}` : (el.getAttribute('role') || el.tagName.toLowerCase()),
        });
      });

      const navLinks: any[] = [];
      document.querySelectorAll('a[href]').forEach((a: any, i: number) => {
        if (i >= 50) return;
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#') || href.startsWith('javascript:')) return;
        navLinks.push({
          text: (a.textContent || '').trim().substring(0, 60),
          href,
        });
      });

      const forms: any[] = [];
      document.querySelectorAll('form').forEach((form: any) => {
        const fields: any[] = [];
        form.querySelectorAll('input,select,textarea').forEach((input: any) => {
          const id = input.id;
          let labelText = null;
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) labelText = (lbl.textContent || '').trim();
          }
          if (!labelText) {
            const parent = input.closest('label');
            if (parent) labelText = (parent.textContent || '').trim().substring(0, 60);
          }
          fields.push({
            name: input.getAttribute('name') || '',
            type: input.getAttribute('type') || input.tagName.toLowerCase(),
            label: labelText,
            required: input.hasAttribute('required'),
            placeholder: input.getAttribute('placeholder') || null,
          });
        });
        forms.push({
          action: form.getAttribute('action'),
          method: form.getAttribute('method') || 'GET',
          fields,
        });
      });

      const landmarks: any[] = [];
      document
        .querySelectorAll('[role="banner"],[role="navigation"],[role="main"],[role="complementary"],[role="contentinfo"],[role="search"],header,nav,main,aside,footer')
        .forEach((el: any) => {
          landmarks.push({
            role: el.getAttribute('role') || el.tagName.toLowerCase(),
            label: el.getAttribute('aria-label') || null,
          });
        });

      return {
        title,
        meta_description: metaDesc,
        headings,
        interactive_elements: interactive,
        navigation_links: navLinks,
        forms,
        aria_landmarks: landmarks,
      };
    });

    // Collect page routes from links
    const baseUrl = new URL(url);
    const pageRoutes = [
      ...new Set(
        (analysis.navigation_links as any[])
          .map((l: any) => {
            try {
              const resolved = new URL(l.href, url);
              return resolved.origin === baseUrl.origin ? resolved.pathname : null;
            } catch {
              return null;
            }
          })
          .filter((r: any): r is string => r !== null),
      ),
    ];

    return {
      url,
      ...analysis,
      api_endpoints: apiEndpoints,
      page_routes: pageRoutes,
    } as PageAnalysis;
  } finally {
    await browser.close();
  }
}
