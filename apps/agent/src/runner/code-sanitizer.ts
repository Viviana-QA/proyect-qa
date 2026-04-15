export class CodeSanitizer {
  // List of dangerous patterns that should NEVER appear in test code
  private static BLOCKED_PATTERNS = [
    /require\s*\(\s*['"](?:fs|child_process|os|path|net|http|https|dgram|cluster|worker_threads|vm)['"]\s*\)/gi,
    /import\s+.*from\s+['"](?:fs|child_process|os|path|net|http|https)['"]/gi,
    /process\.exit/gi,
    /process\.env/gi,
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /execSync|exec\s*\(/gi,
    /spawn\s*\(/gi,
    /unlink|rmdir|rm\s*\(/gi,
    /writeFile|appendFile/gi,
    /fetch\s*\(\s*['"](?!https?:\/\/)/gi, // block non-http fetch (file:// etc)
    /__dirname|__filename/gi,
    /globalThis\./gi,
    /Deno\./gi,
  ];

  // List of allowed globals in the sandbox
  private static ALLOWED_GLOBALS = [
    'page',
    'expect',
    'test',
    'describe',
    'beforeAll',
    'afterAll',
    'beforeEach',
    'afterEach',
    'console',
    'setTimeout',
    'setInterval',
    'clearTimeout',
    'clearInterval',
    'Promise',
    'JSON',
    'Math',
    'Date',
    'Array',
    'Object',
    'String',
    'Number',
    'Boolean',
    'Map',
    'Set',
    'RegExp',
    'Error',
    'URL',
    'URLSearchParams',
  ];

  static sanitize(code: string): {
    safe: boolean;
    code: string;
    violations: string[];
  } {
    const violations: string[] = [];

    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        violations.push(`Blocked pattern detected: ${pattern.source}`);
      }
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
    }

    if (violations.length > 0) {
      return { safe: false, code, violations };
    }

    return { safe: true, code, violations: [] };
  }

  /**
   * Returns the list of allowed global names for sandbox environments.
   */
  static getAllowedGlobals(): string[] {
    return [...this.ALLOWED_GLOBALS];
  }
}
