import * as ts from 'typescript';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  fixed?: string;
}

/**
 * Validate and auto-fix an LLM-generated Playwright test snippet.
 *
 * Strategy:
 * 1. Run a deterministic sanitizer pass (strips markdown, fixes known broken
 *    regex patterns, removes stray imports/exports).
 * 2. Parse the result with the real TypeScript compiler — any SyntaxError
 *    here means the code would not run, so we reject it.
 * 3. Runtime-validate every regex literal via `new RegExp()`. Invalid ones
 *    are replaced with a literal string fallback.
 *
 * Returns { valid: true, fixed } when the snippet is safe to ship, or
 * { valid: false, errors } with human-readable diagnostics.
 */
export function validateAndFixTestCode(raw: string): ValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, errors: ['empty code'] };
  }

  const fixed = sanitize(raw);
  const syntaxErrors = checkSyntax(fixed);
  if (syntaxErrors.length > 0) {
    return { valid: false, errors: syntaxErrors, fixed };
  }

  const regexErrors = validateRegexLiterals(fixed);
  if (regexErrors.length > 0) {
    return { valid: false, errors: regexErrors, fixed };
  }

  if (!looksLikeTest(fixed)) {
    return { valid: false, errors: ['no test() call found'], fixed };
  }

  return { valid: true, errors: [], fixed };
}

function sanitize(raw: string): string {
  let code = raw;

  // Strip markdown fences
  code = code.replace(/^```(?:typescript|ts|javascript|js)?\s*\n?/gim, '');
  code = code.replace(/\n?```\s*$/gim, '');

  // Remove Playwright imports (bundled file adds its own)
  code = code.replace(
    /^\s*import\s*\{[^}]*\}\s*from\s*['"]@playwright\/test['"];?\s*$/gim,
    '',
  );
  // Remove stray exports
  code = code.replace(/^\s*export\s+(default\s+)?.*$/gim, '');

  // Fix the common LLM mistake: /pattern/.*/ → /pattern.*/
  code = code.replace(
    /\/((?:[^/\n\\]|\\.)+)\/(\.?\*)\//g,
    (_, p, suffix) => `/${p}${suffix}/`,
  );

  // Collapse doubled closing slashes: /foo// → /foo/
  code = code.replace(/\/((?:[^/\n\\]|\\.)+)\/\/(?![a-z])/g, '/$1/');

  return code.trim();
}

function checkSyntax(code: string): string[] {
  const errors: string[] = [];
  // Wrap in a minimal module so bare test() calls parse as top-level.
  const wrapped = `import { test, expect } from '@playwright/test';\n${code}`;

  const sf = ts.createSourceFile(
    'generated.ts',
    wrapped,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );

  // `parseDiagnostics` is populated by createSourceFile for syntax errors.
  const diagnostics = (sf as unknown as {
    parseDiagnostics?: ts.DiagnosticWithLocation[];
  }).parseDiagnostics;

  if (diagnostics && diagnostics.length > 0) {
    for (const d of diagnostics) {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      const { line } = sf.getLineAndCharacterOfPosition(d.start ?? 0);
      errors.push(`line ${line}: ${msg}`);
    }
  }

  return errors;
}

/**
 * Extract every regex literal from the code and try `new RegExp()` on each.
 * This catches malformed character classes, unterminated groups, etc. that
 * the TS parser accepts syntactically but JavaScript rejects at construction.
 */
function validateRegexLiterals(code: string): string[] {
  const errors: string[] = [];
  // Naive literal finder: /.../flags not preceded by an identifier or digit
  // (which would make it division). Good enough for generated test code.
  const re = /(?<![A-Za-z0-9_)\]])\/((?:[^/\n\\]|\\.)+)\/([gimsuy]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) {
    const [, pattern, flags] = m;
    try {
      new RegExp(pattern, flags);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`invalid regex /${pattern}/${flags}: ${message}`);
    }
  }
  return errors;
}

function looksLikeTest(code: string): boolean {
  if (!/\btest(?:\.describe|\.only|\.skip)?\s*\(/.test(code)) return false;
  let depth = 0;
  for (const ch of code) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}
