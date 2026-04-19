import { useState, useMemo, useCallback } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useTestRuns } from '@/hooks/use-test-runs';
import { useTestSuites, useTestCases, useDeleteTestSuite } from '@/hooks/use-test-cases';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { TestCase, TestSuite } from '@qa/shared-types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Download,
  Copy,
  Check,
  Terminal,
  FileCode,
  ListChecks,
  Tag,
  Trash2,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GroupedTests {
  suite: TestSuite;
  cases: TestCase[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PRIORITY_VARIANT: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

const TYPE_LABELS: Record<string, string> = {
  e2e: 'E2E',
  regression: 'Regression',
  visual: 'Visual',
  accessibility: 'A11y',
  performance: 'Perf',
  api: 'API',
  cross_browser: 'Cross-Browser',
  responsive: 'Responsive',
};

function codeSummary(code: string, maxLines = 8): string {
  return code.split('\n').slice(0, maxLines).join('\n');
}

/**
 * Concatenates every test's playwright_code into a single spec file.
 * Each case shipped by the AI includes its own `import { test, expect } from
 * '@playwright/test'` — concatenating them raw causes "Duplicate declaration
 * 'test'". We strip per-case imports and emit a single import at the top.
 * Also removes stray ```typescript / ``` markdown fences that sometimes slip
 * through from the LLM output.
 */
function generatePlaywrightFile(tests: TestCase[]): string {
  const cleaned = tests
    .map((tc) => {
      let code = tc.playwright_code || '';
      // Strip markdown code fences
      code = code.replace(/^```(?:typescript|ts|javascript|js)?\s*\n?/gim, '');
      code = code.replace(/\n?```\s*$/gim, '');
      // Strip every `import ... from '@playwright/test';` line
      code = code.replace(
        /^\s*import\s*\{[^}]*\}\s*from\s*['"]@playwright\/test['"];?\s*$/gim,
        '',
      );
      return code.trim();
    })
    .filter(Boolean)
    .join('\n\n');

  return `import { test, expect } from '@playwright/test';\n\n${cleaned}\n`;
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// One-liner that: moves the downloaded spec into an isolated folder,
// installs @playwright/test + chromium, writes a minimal playwright.config.ts
// (so --project=chromium resolves), runs the tests, then opens the HTML report.
const MAC_COMMAND = `cd ~/Downloads && mkdir -p qa-tests && mv generated-tests.spec.ts qa-tests/ && cd qa-tests && npm init -y > /dev/null 2>&1 && npm i -D @playwright/test > /dev/null 2>&1 && npx playwright install chromium > /dev/null 2>&1 && printf "import { defineConfig, devices } from '@playwright/test';\\nexport default defineConfig({ testDir: '.', reporter: 'html', projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }] });\\n" > playwright.config.ts && npx playwright test generated-tests.spec.ts --project=chromium --reporter=html; npx playwright show-report`;

const WINDOWS_COMMAND = `cd $env:USERPROFILE\\Downloads; mkdir qa-tests -Force | Out-Null; mv generated-tests.spec.ts qa-tests\\; cd qa-tests; npm init -y 2>$null; npm i -D @playwright/test 2>$null; npx playwright install chromium 2>$null; "import { defineConfig, devices } from '@playwright/test';\`nexport default defineConfig({ testDir: '.', reporter: 'html', projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }] });" | Out-File -Encoding utf8 playwright.config.ts; npx playwright test generated-tests.spec.ts --project=chromium --reporter=html; npx playwright show-report`;

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function TestRunnerPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  /* Data fetching */
  const { data: suites } = useTestSuites(projectId!);
  const { data: allCases } = useTestCases(projectId!, { status: 'active' });
  const { data: runs, isLoading: runsLoading } = useTestRuns(projectId!);

  /* Mutations */
  const deleteTestSuite = useDeleteTestSuite(projectId!);

  /* Local state */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [collapsedSuites, setCollapsedSuites] = useState<Set<string>>(new Set());
  const [browser, setBrowser] = useState('chromium');
  const [headless, setHeadless] = useState(true);
  const [copiedCli, setCopiedCli] = useState(false);
  const [activeTab, setActiveTab] = useState<'mac' | 'windows'>('mac');
  const [copiedHowTo, setCopiedHowTo] = useState(false);

  /* Group test cases by suite */
  const grouped = useMemo<GroupedTests[]>(() => {
    if (!suites || !allCases) return [];
    return suites
      .map((suite) => ({
        suite,
        cases: allCases.filter((tc) => tc.suite_id === suite.id),
      }))
      .filter((g) => g.cases.length > 0);
  }, [suites, allCases]);

  /* Derived counts */
  const totalTests = allCases?.length ?? 0;
  const selectedCount = selectedIds.size;

  /* Ordered selection for export (maintain insertion order) */
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);

  const selectedTests = useMemo(() => {
    if (!allCases) return [];
    const ordered = selectionOrder.filter((id) => selectedIds.has(id));
    return ordered.map((id) => allCases.find((tc) => tc.id === id)!).filter(Boolean);
  }, [allCases, selectedIds, selectionOrder]);

  /* ---- Selection helpers ---- */

  const toggleTest = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setSelectionOrder((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        return [...prev, id];
      });
    },
    [],
  );

  const toggleSuiteAll = useCallback(
    (suiteId: string, cases: TestCase[]) => {
      const ids = cases.map((c) => c.id);
      const allSelected = ids.every((id) => selectedIds.has(id));

      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => {
          if (allSelected) {
            next.delete(id);
          } else {
            next.add(id);
          }
        });
        return next;
      });
      setSelectionOrder((prev) => {
        if (allSelected) return prev.filter((id) => !ids.includes(id));
        const newIds = ids.filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
    },
    [selectedIds],
  );

  /* ---- Expand / collapse helpers ---- */

  const toggleTestExpand = useCallback((id: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSuiteCollapse = useCallback((id: string) => {
    setCollapsedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ---- Reorder helpers ---- */

  const moveTest = useCallback(
    (id: string, direction: 'up' | 'down') => {
      setSelectionOrder((prev) => {
        const idx = prev.indexOf(id);
        if (idx === -1) return prev;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
        return next;
      });
    },
    [],
  );

  /* ---- Delete helpers ---- */

  const handleDeleteSuite = (suiteId: string) => {
    if (confirm(t('runner.confirmDeleteSuite'))) {
      deleteTestSuite.mutate(suiteId);
    }
  };

  const handleDeleteAll = () => {
    if (!suites || suites.length === 0) return;
    if (confirm(t('runner.confirmDeleteAll'))) {
      suites.forEach((suite) => {
        deleteTestSuite.mutate(suite.id);
      });
    }
  };

  /* ---- Export & CLI ---- */

  const cliCommand = `npx playwright test generated-tests.spec.ts --project=${browser}${headless ? '' : ' --headed'}`;

  const handleExport = () => {
    if (selectedTests.length === 0) return;
    const content = generatePlaywrightFile(selectedTests);
    downloadBlob(content, 'generated-tests.spec.ts');
  };

  const handleCopyCli = async () => {
    await navigator.clipboard.writeText(cliCommand);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleCopyHowTo = async (command: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedHowTo(true);
    setTimeout(() => setCopiedHowTo(false), 2000);
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1e1b4b]">{t('runner.title')}</h1>
          <p className="mt-1 text-muted-foreground">
            {t('runner.subtitle')}
          </p>
        </div>
        {grouped.length > 0 && (
          <Button
            variant="outline"
            onClick={handleDeleteAll}
            disabled={deleteTestSuite.isPending}
            className="gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            {t('runner.deleteAll')}
          </Button>
        )}
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Test Selection by Module / Suite                              */}
      {/* ------------------------------------------------------------ */}
      <div className="space-y-3">
        {grouped.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ListChecks className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p>{t('runner.noTests')}</p>
            </CardContent>
          </Card>
        )}

        {grouped.map(({ suite, cases }) => {
          const isCollapsed = collapsedSuites.has(suite.id);
          const allSelected = cases.every((c) => selectedIds.has(c.id));
          const someSelected = cases.some((c) => selectedIds.has(c.id));
          const selectedInSuite = cases.filter((c) => selectedIds.has(c.id)).length;

          return (
            <Card key={suite.id} className="overflow-hidden border-[#7c3aed]/20">
              {/* Suite header */}
              <div className="flex w-full items-center justify-between bg-[#f5f3ff] px-4 py-3 hover:bg-[#ede9fe] transition-colors">
                <button
                  type="button"
                  onClick={() => toggleSuiteCollapse(suite.id)}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-[#7c3aed]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#7c3aed]" />
                  )}
                  <span className="font-semibold text-[#1e1b4b]">{suite.name}</span>
                  <Badge variant="info">{TYPE_LABELS[suite.test_type] ?? suite.test_type}</Badge>
                  <span className="text-sm text-muted-foreground">
                    ({selectedInSuite}/{cases.length} {t('runner.selected')})
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={allSelected}
                      data-indeterminate={someSelected && !allSelected ? true : undefined}
                      onCheckedChange={() => toggleSuiteAll(suite.id, cases)}
                      className="border-[#7c3aed] data-[state=checked]:bg-[#7c3aed]"
                    />
                    <span className="text-xs text-muted-foreground">
                      {t('runner.selectAll')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSuite(suite.id);
                    }}
                    className="rounded p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    title={t('runner.deleteSuite')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Test case list */}
              {!isCollapsed && (
                <div className="divide-y">
                  {cases.map((tc) => {
                    const isSelected = selectedIds.has(tc.id);
                    const isExpanded = expandedTests.has(tc.id);
                    const orderIdx = selectionOrder.indexOf(tc.id);

                    return (
                      <div key={tc.id} className="group">
                        {/* Test row */}
                        <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#f5f3ff]/50 transition-colors">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleTest(tc.id)}
                              className="border-[#7c3aed] data-[state=checked]:bg-[#7c3aed]"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleTestExpand(tc.id)}
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">{tc.title}</span>
                          </button>

                          {/* Badges */}
                          <Badge variant={PRIORITY_VARIANT[tc.priority] ?? 'secondary'} className="text-[10px]">
                            {t(`priority.${tc.priority}`, tc.priority)}
                          </Badge>

                          {/* Reorder buttons (visible when selected) */}
                          {isSelected && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => moveTest(tc.id, 'up')}
                                disabled={orderIdx <= 0}
                                className="rounded p-1 text-muted-foreground hover:text-[#7c3aed] hover:bg-[#f5f3ff] disabled:opacity-30"
                                title={t('testRunner.moveUp', 'Move up')}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveTest(tc.id, 'down')}
                                disabled={orderIdx >= selectionOrder.length - 1}
                                className="rounded p-1 text-muted-foreground hover:text-[#7c3aed] hover:bg-[#f5f3ff] disabled:opacity-30"
                                title={t('testRunner.moveDown', 'Move down')}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="border-t bg-[#f5f3ff]/30 px-12 py-4 space-y-3">
                            {tc.description && (
                              <p className="text-sm text-muted-foreground">{tc.description}</p>
                            )}

                            {tc.tags.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                {tc.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-[10px]">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            <div className="rounded-md bg-[#1e1b4b] p-4 overflow-auto">
                              <pre className="text-xs text-green-300 font-mono whitespace-pre">
                                {codeSummary(tc.playwright_code)}
                              </pre>
                              {tc.playwright_code.split('\n').length > 8 && (
                                <p className="mt-2 text-xs text-purple-300">
                                  {t('testRunner.viewFullCode', '... view full code in test details')}
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Selection summary */}
      {totalTests > 0 && (
        <p className="text-sm font-medium text-[#7c3aed]">
          {t('runner.selectedCount', {
            count: selectedCount,
            total: totalTests,
          })}
        </p>
      )}

      {/* ------------------------------------------------------------ */}
      {/*  Run Options & Export                                          */}
      {/* ------------------------------------------------------------ */}
      <Card className="border-[#7c3aed]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[#1e1b4b]">
            <FileCode className="h-5 w-5 text-[#7c3aed]" />
            {t('testRunner.runOptions', 'Run Options')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Browser selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('runner.browser')}</label>
              <select
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed]"
              >
                <option value="chromium">{t('testRunner.browserChromium')}</option>
                <option value="firefox">{t('testRunner.browserFirefox')}</option>
                <option value="webkit">{t('testRunner.browserWebkit')}</option>
              </select>
            </div>

            {/* Headless toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('runner.headless')}
              </label>
              <select
                value={headless ? 'yes' : 'no'}
                onChange={(e) => setHeadless(e.target.value === 'yes')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-[#7c3aed]/30 focus:border-[#7c3aed]"
              >
                <option value="yes">{t('testRunner.headlessYes', 'Yes')}</option>
                <option value="no">{t('testRunner.headlessNo', 'No')}</option>
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleExport}
              disabled={selectedCount === 0}
              size="lg"
              className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-base px-6 py-3"
            >
              <Download className="h-5 w-5" />
              {t('runner.exportConfig')}
            </Button>
            <Button
              variant="outline"
              onClick={handleCopyCli}
              disabled={selectedCount === 0}
              className="border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#f5f3ff]"
            >
              {copiedCli ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copiedCli
                ? t('runner.copied')
                : t('runner.copyCli')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/*  How to Run Your Tests                                        */}
      {/* ------------------------------------------------------------ */}
      <Card className="border-[#7c3aed]/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-[#1e1b4b]">
            <Terminal className="h-5 w-5 text-[#7c3aed]" />
            {t('runner.howToRun')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('runner.howToRunDesc')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Steps */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-[#1e1b4b]">
              {t('runner.step1')}
            </p>
            <p className="text-sm font-medium text-[#1e1b4b]">
              {t('runner.step2')}
            </p>
          </div>

          {/* OS Tabs */}
          <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('mac')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'mac'
                  ? 'bg-white text-[#7c3aed] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('runner.mac')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('windows')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === 'windows'
                  ? 'bg-white text-[#7c3aed] shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('runner.windows')}
            </button>
          </div>

          {/* Command block */}
          <div className="rounded-md bg-[#1e1b4b] p-4">
            <div className="flex items-start justify-between gap-4">
              <code className="text-sm text-green-300 font-mono break-all whitespace-pre-wrap leading-relaxed">
                $ {activeTab === 'mac' ? MAC_COMMAND : WINDOWS_COMMAND}
              </code>
              <button
                type="button"
                onClick={() => handleCopyHowTo(activeTab === 'mac' ? MAC_COMMAND : WINDOWS_COMMAND)}
                className="shrink-0 rounded p-2 text-purple-300 hover:bg-white/10 transition-colors"
                title={t('runner.copyCli')}
              >
                {copiedHowTo ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/*  Run History                                                   */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('runner.runHistory')}</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <p className="text-muted-foreground">{t('testRunner.loading')}</p>
          ) : !runs?.length ? (
            <p className="text-sm text-muted-foreground">{t('runner.noRuns')}</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <RunStatusIcon status={run.status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{run.browser}</span>
                        <Badge variant="secondary">{t(`status.${run.status}`, run.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                        {run.duration_ms && ` - ${(run.duration_ms / 1000).toFixed(1)}s`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">
                      {t('testRunner.passed', { count: run.passed })}
                    </span>
                    <span className="text-red-600">
                      {t('testRunner.failed', { count: run.failed })}
                    </span>
                    <span className="text-muted-foreground">
                      {t('testRunner.skipped', { count: run.skipped })}
                    </span>
                    <span className="font-medium">
                      {t('testRunner.total', { count: run.total_tests })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helper component (kept from original)                        */
/* ------------------------------------------------------------------ */

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-500" />;
    case 'running':
      return <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />;
    default:
      return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}
