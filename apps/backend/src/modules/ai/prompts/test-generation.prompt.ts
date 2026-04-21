import { AIGenerateRequest, TestType } from '../../../shared-types';

export function buildTestGenerationPrompt(request: AIGenerateRequest): string {
  const typeInstructions = request.test_types
    .map((t) => getTypeInstructions(t))
    .join('\n\n');

  const pageContext = request.page_analysis
    ? `
PAGE ANALYSIS:
- Title: ${request.page_analysis.title}
- URL: ${request.page_analysis.url}
- Headings: ${JSON.stringify(request.page_analysis.headings)}
- Interactive Elements: ${JSON.stringify(request.page_analysis.interactive_elements.slice(0, 50))}
- Forms: ${JSON.stringify(request.page_analysis.forms)}
- Navigation Links: ${JSON.stringify(request.page_analysis.navigation_links.slice(0, 30))}
- ARIA Landmarks: ${JSON.stringify(request.page_analysis.aria_landmarks)}
- API Endpoints: ${JSON.stringify(request.page_analysis.api_endpoints)}
- Page Routes: ${JSON.stringify(request.page_analysis.page_routes)}
`
    : `URL: ${request.base_url}`;

  return `You are an expert QA automation engineer. Generate Playwright test scripts in TypeScript for the following web application.

${pageContext}

${request.additional_context ? `ADDITIONAL CONTEXT: ${request.additional_context}` : ''}

TEST TYPES TO GENERATE:
${typeInstructions}

REQUIREMENTS:
- Use @playwright/test framework with TypeScript
- Use accessible selectors: getByRole, getByLabel, getByText, getByPlaceholder (prefer over CSS selectors)
- Include proper assertions with expect()
- Handle dynamic content with appropriate waits (auto-waiting is built-in)
- Each test must be independent and self-contained
- Include descriptive test names and comments
- Generate 3-5 tests per test type requested

SYNTAX RULES (MUST FOLLOW — the output is parsed with the TypeScript compiler and invalid tests are DROPPED):
- Regex literals: ONLY valid JavaScript regex. NEVER put characters after the closing /. WRONG: /.*foo/.*/  CORRECT: /.*foo.*/
- Regex literals: escape forward slashes inside patterns. WRONG: /path/to/ CORRECT: /path\\/to/
- Strings: always balance quotes. Prefer single quotes unless the string contains one.
- Template literals: balance backticks and \${}. Never leave \${ unclosed.
- Parentheses, braces, brackets: always balanced.
- Semicolons: required at the end of statements inside test callbacks.
- No markdown fences, no triple-backtick blocks anywhere in the playwright_code value.
- No top-level imports other than @playwright/test (the runner adds it automatically — but it's fine if you include it, it will be stripped).
- No export statements in the test code.
- The code MUST contain at least one test(...) call. Do not return bare helper functions.
- Prefer string locators or getByRole over regex whenever possible. Use regex ONLY when you need pattern matching.

OUTPUT FORMAT:
Return a JSON array of test cases with this structure:
[
  {
    "title": "descriptive test name",
    "description": "what this test validates",
    "test_type": "e2e|regression|visual|accessibility|performance|api|cross_browser|responsive",
    "priority": "low|medium|high|critical",
    "tags": ["tag1", "tag2"],
    "playwright_code": "import { test, expect } from '@playwright/test';\\n\\ntest('test name', async ({ page }) => {\\n  // test code\\n});",
    "browser_targets": ["chromium"],
    "viewport_config": null
  }
]`;
}

function getTypeInstructions(type: TestType): string {
  const instructions: Record<TestType, string> = {
    e2e: `E2E TESTS:
- Test complete user flows: navigation, form submissions, authentication, CRUD operations
- Verify the happy path and common error scenarios
- Test multi-step workflows end-to-end`,

    regression: `REGRESSION TESTS:
- Test every discovered interactive element functions correctly
- Verify all navigation links work
- Check form validations and error states
- Test edge cases and boundary conditions`,

    visual: `VISUAL REGRESSION TESTS:
- Navigate to each main route and capture full-page screenshots
- Use await expect(page).toHaveScreenshot() for comparison
- Include key states: empty, loaded, error
- Test both light and dark themes if applicable`,

    accessibility: `ACCESSIBILITY TESTS:
- Import and use @axe-core/playwright
- Run axe.check() on each page
- Verify ARIA labels, roles, and landmarks
- Check keyboard navigation and focus management
- Test color contrast and text alternatives
Example:
import AxeBuilder from '@axe-core/playwright';
const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);`,

    performance: `PERFORMANCE TESTS:
- Measure Core Web Vitals: LCP, FCP, CLS, TTFB
- Use page.evaluate(() => performance.getEntriesByType('navigation'))
- Check page load times are under acceptable thresholds
- Test with network throttling if needed`,

    api: `API TESTS:
- Use Playwright's request API context for direct HTTP testing
- Test GET, POST, PUT, DELETE endpoints
- Verify response status codes, headers, and body structure
- Test error responses and edge cases
Example:
const response = await request.get('/api/endpoint');
expect(response.ok()).toBeTruthy();`,

    cross_browser: `CROSS-BROWSER TESTS:
- Same core tests but annotated for multiple browsers
- Focus on browser-specific rendering issues
- Test CSS features that vary across browsers
- Set browser_targets to ["chromium", "firefox", "webkit"]`,

    responsive: `RESPONSIVE TESTS:
- Test at mobile (375x812), tablet (768x1024), and desktop (1280x800) viewports
- Verify responsive breakpoints
- Test touch interactions for mobile
- Check navigation menu behavior across sizes
- Set viewport_config for each test`,
  };

  return instructions[type];
}

export function buildRefinePrompt(
  currentCode: string,
  feedback: string,
): string {
  return `You are a Playwright test expert. Refine the following test based on the feedback.

CURRENT TEST CODE:
\`\`\`typescript
${currentCode}
\`\`\`

FEEDBACK:
${feedback}

SYNTAX RULES (STRICT — your output is parsed with the TypeScript compiler and REJECTED if invalid):
- Regex literals must be valid JavaScript. NEVER put characters after the closing /. WRONG: /.*foo/.*/  CORRECT: /.*foo.*/
- Escape forward slashes inside regex patterns.
- Balance every quote, backtick, paren, brace, bracket. Never leave \${ unclosed.
- No markdown fences or triple-backtick blocks in the response.
- No export statements.
- The code MUST contain at least one test(...) call.

Return ONLY the refined TypeScript test code, no explanations. Keep the @playwright/test import and test structure.`;
}

export function buildAnalyzePrompt(url: string, pageData: string): string {
  return `Analyze this web page and provide a structured summary for QA test generation.

URL: ${url}
PAGE DATA:
${pageData}

Return a JSON summary with:
{
  "summary": "Brief description of the application",
  "main_features": ["feature1", "feature2"],
  "user_flows": ["flow1", "flow2"],
  "potential_issues": ["issue1", "issue2"],
  "recommended_test_types": ["e2e", "accessibility"],
  "priority_areas": ["area1", "area2"]
}`;
}
