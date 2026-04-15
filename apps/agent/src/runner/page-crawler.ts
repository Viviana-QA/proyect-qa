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

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
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

      // Extract all meta tags
      const metaTags: { name: string; content: string }[] = [];
      document.querySelectorAll('meta[name], meta[property]').forEach((meta: any) => {
        const name = meta.getAttribute('name') || meta.getAttribute('property') || '';
        const content = meta.getAttribute('content') || '';
        if (name && content) {
          metaTags.push({ name, content });
        }
      });

      // Detect CSS/JS frameworks by inspecting class names, root elements, scripts
      const detectedFrameworks: string[] = [];

      // Tailwind CSS: look for utility classes
      const allClasses = Array.from(document.querySelectorAll('[class]'))
        .slice(0, 200)
        .flatMap((el: any) => el.className.split ? el.className.split(/\s+/) : []);
      const tailwindPatterns = /^(flex|grid|p-|m-|text-|bg-|border-|rounded-|w-|h-|gap-|space-|items-|justify-)/;
      const tailwindMatches = allClasses.filter((c) => tailwindPatterns.test(c));
      if (tailwindMatches.length > 5) {
        detectedFrameworks.push('Tailwind CSS');
      }

      // Bootstrap: look for bootstrap-specific classes
      const bootstrapPatterns = /^(btn|btn-|col-|row|container|navbar|card|modal|form-control|form-group|d-flex)/;
      const bootstrapMatches = allClasses.filter((c) => bootstrapPatterns.test(c));
      if (bootstrapMatches.length > 3) {
        detectedFrameworks.push('Bootstrap');
      }

      // Material UI: look for MUI class prefixes
      const muiMatches = allClasses.filter((c) => /^(Mui|MuiButton|MuiTypography|css-[a-z0-9]+)/.test(c));
      if (muiMatches.length > 3) {
        detectedFrameworks.push('Material UI');
      }

      // React: check for root element with _reactRootContainer or data-reactroot
      if (
        document.querySelector('[data-reactroot]') ||
        document.querySelector('#root') ||
        (document.querySelector('#__next') !== null)
      ) {
        detectedFrameworks.push('React');
      }
      // Also check script tags for react
      const scripts = Array.from(document.querySelectorAll('script[src]')).map((s: any) => s.src);
      if (scripts.some((s) => /react/i.test(s))) {
        detectedFrameworks.push('React');
      }

      // Vue: check for __vue__ or Vue-specific attributes
      if (
        document.querySelector('[data-v-]') ||
        document.querySelector('#app') ||
        scripts.some((s) => /vue/i.test(s))
      ) {
        detectedFrameworks.push('Vue');
      }

      // Angular: check for ng-version or angular-specific attributes
      if (
        document.querySelector('[ng-version]') ||
        document.querySelector('[_nghost]') ||
        document.querySelector('[_ngcontent]') ||
        scripts.some((s) => /angular/i.test(s))
      ) {
        detectedFrameworks.push('Angular');
      }

      // Next.js
      if (document.querySelector('#__next') || document.querySelector('script#__NEXT_DATA__')) {
        detectedFrameworks.push('Next.js');
      }

      // Nuxt
      if (document.querySelector('#__nuxt') || document.querySelector('#__layout')) {
        detectedFrameworks.push('Nuxt');
      }

      // Performance metrics
      let performanceData = { domContentLoaded: 0, load: 0, firstPaint: 0 };
      try {
        const navEntry = performance.getEntriesByType('navigation')[0] as any;
        if (navEntry) {
          performanceData.domContentLoaded = Math.round(navEntry.domContentLoadedEventEnd - navEntry.startTime);
          performanceData.load = Math.round(navEntry.loadEventEnd - navEntry.startTime);
        }
        const paintEntries = performance.getEntriesByType('paint');
        const fp = paintEntries.find((e) => e.name === 'first-paint');
        if (fp) {
          performanceData.firstPaint = Math.round(fp.startTime);
        }
      } catch {
        // Performance API not available
      }

      // De-duplicate frameworks
      const uniqueFrameworks = [...new Set(detectedFrameworks)];

      return {
        title,
        meta_description: metaDesc,
        headings,
        interactive_elements: interactive,
        navigation_links: navLinks,
        forms,
        aria_landmarks: landmarks,
        meta_tags: metaTags,
        detected_frameworks: uniqueFrameworks,
        performance_data: performanceData,
      };
    });

    // Accessibility tree (Playwright built-in)
    let accessibilityTree: any = null;
    try {
      accessibilityTree = await (page as any).accessibility?.snapshot?.() ?? null;
    } catch {
      // Accessibility snapshot may fail on some pages
    }

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
      accessibility_tree: accessibilityTree,
      console_errors: consoleErrors.length > 0 ? consoleErrors : undefined,
    } as PageAnalysis;
  } finally {
    await browser.close();
  }
}

/**
 * Crawl multiple pages by following same-origin navigation links from the main page.
 * Returns an array of PageAnalysis results (one per page).
 */
export async function crawlMultiplePages(
  urls: string[],
  options: { maxPages?: number } = {},
): Promise<PageAnalysis[]> {
  const maxPages = options.maxPages ?? 10;
  const results: PageAnalysis[] = [];
  const visited = new Set<string>();

  // Crawl the provided URLs, then follow discovered links up to maxPages
  const queue = [...urls];

  while (queue.length > 0 && results.length < maxPages) {
    const nextUrl = queue.shift()!;

    // Normalize URL for dedup
    let normalized: string;
    try {
      const parsed = new URL(nextUrl);
      normalized = `${parsed.origin}${parsed.pathname}`;
    } catch {
      continue;
    }

    if (visited.has(normalized)) continue;
    visited.add(normalized);

    try {
      const analysis = await crawlPage(nextUrl);
      results.push(analysis);

      // Add discovered same-origin routes to the queue
      if (results.length < maxPages) {
        const baseOrigin = new URL(nextUrl).origin;
        for (const route of analysis.page_routes) {
          const fullUrl = `${baseOrigin}${route}`;
          const routeNormalized = `${baseOrigin}${route}`;
          if (!visited.has(routeNormalized) && !queue.includes(fullUrl)) {
            queue.push(fullUrl);
          }
        }
      }
    } catch (err: any) {
      console.warn(`  Skipping ${nextUrl}: ${err.message}`);
    }
  }

  return results;
}
