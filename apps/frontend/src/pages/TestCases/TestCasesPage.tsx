import { useState, useMemo } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  useTestCases,
  useTestSuites,
  useCreateTestCase,
  useUpdateTestCase,
  useDeleteTestCase,
} from '@/hooks/use-test-cases';
import { TestCaseEditor } from '@/components/test-editor/TestCaseEditor';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Plus,
  Trash2,
  Code2,
  ChevronDown,
  ChevronRight,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import type { TestType, TestPriority, TestCase, CreateTestCaseDto } from '@qa/shared-types';

const TEST_TYPES: TestType[] = [
  'e2e', 'regression', 'visual', 'accessibility',
  'performance', 'api', 'cross_browser', 'responsive',
];

const PRIORITIES: TestPriority[] = ['low', 'medium', 'high', 'critical'];

const priorityVariant = (p: string) => {
  if (p === 'critical') return 'destructive' as const;
  if (p === 'high') return 'warning' as const;
  return 'secondary' as const;
};

const statusVariant = (s: string) => (s === 'active' ? 'success' as const : 'secondary' as const);

interface AddFormState {
  suiteId: string;
  title: string;
  description: string;
  test_type: TestType;
  priority: TestPriority;
  playwright_code: string;
  tags: string;
}

const emptyForm = (suiteId: string): AddFormState => ({
  suiteId,
  title: '',
  description: '',
  test_type: 'e2e',
  priority: 'medium',
  playwright_code: "import { test, expect } from '@playwright/test';\n\ntest('new test', async ({ page }) => {\n  await page.goto('/');\n});",
  tags: '',
});

export function TestCasesPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [editorTestCase, setEditorTestCase] = useState<TestCase | null>(null);
  const [addFormSuiteId, setAddFormSuiteId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddFormState | null>(null);

  const { data: testCases, isLoading: loadingCases } = useTestCases(projectId!, {
    test_type: typeFilter || undefined,
  });
  const { data: testSuites, isLoading: loadingSuites } = useTestSuites(projectId!);
  const createTestCase = useCreateTestCase(projectId!);
  const updateTestCase = useUpdateTestCase();
  const deleteTestCase = useDeleteTestCase();

  // Group test cases by suite_id
  const grouped = useMemo(() => {
    if (!testCases) return new Map<string, TestCase[]>();
    const map = new Map<string, TestCase[]>();
    for (const tc of testCases) {
      const key = tc.suite_id || '__unassigned__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tc);
    }
    return map;
  }, [testCases]);

  // Filter logic
  const filteredGrouped = useMemo(() => {
    const result = new Map<string, TestCase[]>();
    const q = search.toLowerCase();
    for (const [suiteId, cases] of grouped) {
      const filtered = cases.filter(
        (tc) =>
          tc.title.toLowerCase().includes(q) ||
          (tc.description || '').toLowerCase().includes(q) ||
          tc.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
      if (filtered.length > 0) result.set(suiteId, filtered);
    }
    return result;
  }, [grouped, search]);

  const suiteName = (suiteId: string) => {
    if (suiteId === '__unassigned__') return 'Unassigned Tests';
    return testSuites?.find((s) => s.id === suiteId)?.name || 'Unknown Suite';
  };

  const toggleSuite = (id: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleCase = (id: string) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Inline title editing
  const startEditTitle = (tc: TestCase) => {
    setEditingTitleId(tc.id);
    setEditingTitleValue(tc.title);
  };

  const saveTitle = (id: string) => {
    if (editingTitleValue.trim()) {
      updateTestCase.mutate({ id, dto: { title: editingTitleValue.trim() } });
    }
    setEditingTitleId(null);
  };

  const cancelEditTitle = () => {
    setEditingTitleId(null);
  };

  // Code editor save
  const handleCodeSave = (code: string) => {
    if (editorTestCase) {
      updateTestCase.mutate(
        { id: editorTestCase.id, dto: { playwright_code: code } },
        { onSuccess: () => setEditorTestCase(null) },
      );
    }
  };

  // Add test case form
  const openAddForm = (suiteId: string) => {
    setAddFormSuiteId(suiteId);
    setAddForm(emptyForm(suiteId));
  };

  const submitAddForm = () => {
    if (!addForm || !addForm.title.trim() || addForm.suiteId === '__unassigned__') return;
    const dto: CreateTestCaseDto = {
      suite_id: addForm.suiteId,
      title: addForm.title.trim(),
      description: addForm.description.trim() || undefined,
      test_type: addForm.test_type,
      priority: addForm.priority,
      playwright_code: addForm.playwright_code,
      tags: addForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    createTestCase.mutate(dto, {
      onSuccess: () => {
        setAddForm(null);
        setAddFormSuiteId(null);
      },
    });
  };

  const isLoading = loadingCases || loadingSuites;
  const totalCases = testCases?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e1b4b]">{t('testCases.title')}</h1>
          {totalCases > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {totalCases} test case{totalCases !== 1 ? 's' : ''} across {filteredGrouped.size} module{filteredGrouped.size !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('testCases.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t('testCases.allTypes')}</option>
          {TEST_TYPES.map((tt) => (
            <option key={tt} value={tt}>{tt.replace('_', ' ').toUpperCase()}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-muted-foreground">{t('testCases.loading')}</p>
      ) : filteredGrouped.size === 0 ? (
        <div className="py-12 text-center">
          <Code2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">{t('testCases.noTestCasesFound')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(filteredGrouped.entries()).map(([suiteId, cases]) => {
            const isExpanded = expandedSuites.has(suiteId);
            return (
              <Card key={suiteId} className="overflow-hidden shadow-sm border-[#e9e5f5]">
                {/* Module Header */}
                <button
                  onClick={() => toggleSuite(suiteId)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-[#f5f3ff]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-[#7c3aed]" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-[#7c3aed]" />
                    )}
                    <div>
                      <h3 className="font-semibold text-[#1e1b4b]">{suiteName(suiteId)}</h3>
                      <p className="text-xs text-muted-foreground">
                        {cases.length} test case{cases.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs bg-[#f5f3ff] text-[#7c3aed] border-[#7c3aed]/30">
                    {cases.length}
                  </Badge>
                </button>

                {/* Expanded Module Content */}
                {isExpanded && (
                  <div className="border-t border-[#e9e5f5]">
                    <div className="divide-y divide-[#e9e5f5]">
                      {cases.map((tc) => {
                        const isCaseExpanded = expandedCases.has(tc.id);
                        return (
                          <div key={tc.id} className="bg-white">
                            {/* Test Case Row */}
                            <div
                              className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-[#f5f3ff]/30 transition-colors"
                              onClick={() => toggleCase(tc.id)}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {isCaseExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-[#7c3aed] shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}

                                {/* Title: inline edit or display */}
                                {editingTitleId === tc.id ? (
                                  <div
                                    className="flex items-center gap-2 flex-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Input
                                      value={editingTitleValue}
                                      onChange={(e) => setEditingTitleValue(e.target.value)}
                                      className="h-7 text-sm"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveTitle(tc.id);
                                        if (e.key === 'Escape') cancelEditTitle();
                                      }}
                                    />
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-[#10b981]"
                                      onClick={() => saveTitle(tc.id)}
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground"
                                      onClick={cancelEditTitle}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span
                                    className="text-sm font-medium text-[#1e1b4b] truncate cursor-text hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditTitle(tc);
                                    }}
                                    title="Click to edit title"
                                  >
                                    {tc.title}
                                  </span>
                                )}

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {tc.test_type}
                                  </Badge>
                                  <Badge variant={priorityVariant(tc.priority)} className="text-[10px] px-1.5 py-0">
                                    {tc.priority}
                                  </Badge>
                                  <Badge variant={statusVariant(tc.status)} className="text-[10px] px-1.5 py-0">
                                    {tc.status}
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 ml-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-[#7c3aed]"
                                  onClick={() => startEditTitle(tc)}
                                  title="Edit title"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(t('testCases.deleteConfirm'))) {
                                      deleteTestCase.mutate(tc.id);
                                    }
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Expanded Detail */}
                            {isCaseExpanded && (
                              <div className="px-5 pb-4 pt-1 ml-7 space-y-3 bg-[#f5f3ff]/20">
                                {/* Description */}
                                {tc.description && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                                    <p className="text-sm text-[#1e1b4b]">{tc.description}</p>
                                  </div>
                                )}

                                {/* Module / Suite */}
                                <div className="flex gap-6">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Module / Suite</p>
                                    <p className="text-sm text-[#1e1b4b]">{suiteName(tc.suite_id)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Type</p>
                                    <Badge variant="outline">{tc.test_type}</Badge>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Priority</p>
                                    <Badge variant={priorityVariant(tc.priority)}>{tc.priority}</Badge>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                                    <Badge variant={statusVariant(tc.status)}>{tc.status}</Badge>
                                  </div>
                                </div>

                                {/* Tags */}
                                {tc.tags.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Tags</p>
                                    <div className="flex gap-1 flex-wrap">
                                      {tc.tags.map((tag) => (
                                        <Badge key={tag} variant="outline" className="text-xs bg-[#f5f3ff] text-[#7c3aed]">
                                          {tag}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Code Preview */}
                                {tc.playwright_code && (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="text-xs font-medium text-muted-foreground">Code Preview</p>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs gap-1 border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#f5f3ff]"
                                        onClick={() => setEditorTestCase(tc)}
                                      >
                                        <Code2 className="h-3 w-3" />
                                        Edit Code
                                      </Button>
                                    </div>
                                    <pre className="rounded-md bg-[#1e1b4b] p-3 text-xs text-green-400 font-mono overflow-x-auto leading-relaxed">
                                      {tc.playwright_code
                                        .split('\n')
                                        .slice(0, 5)
                                        .join('\n')}
                                      {tc.playwright_code.split('\n').length > 5 && '\n// ...'}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Test Case Button */}
                    {suiteId !== '__unassigned__' && (
                      <div className="px-5 py-3 border-t border-[#e9e5f5] bg-[#f5f3ff]/30">
                        {addFormSuiteId === suiteId && addForm ? (
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-[#1e1b4b]">Add New Test Case</h4>
                            <Input
                              placeholder="Test case title"
                              value={addForm.title}
                              onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                            />
                            <Textarea
                              placeholder="Description (optional)"
                              value={addForm.description}
                              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                              rows={2}
                            />
                            <div className="flex gap-3">
                              <select
                                value={addForm.test_type}
                                onChange={(e) => setAddForm({ ...addForm, test_type: e.target.value as TestType })}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1"
                              >
                                {TEST_TYPES.map((tt) => (
                                  <option key={tt} value={tt}>{tt.replace('_', ' ').toUpperCase()}</option>
                                ))}
                              </select>
                              <select
                                value={addForm.priority}
                                onChange={(e) => setAddForm({ ...addForm, priority: e.target.value as TestPriority })}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm flex-1"
                              >
                                {PRIORITIES.map((p) => (
                                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Playwright Code
                              </label>
                              <Textarea
                                value={addForm.playwright_code}
                                onChange={(e) => setAddForm({ ...addForm, playwright_code: e.target.value })}
                                rows={6}
                                className="font-mono text-xs"
                              />
                            </div>
                            <Input
                              placeholder="Tags (comma-separated)"
                              value={addForm.tags}
                              onChange={(e) => setAddForm({ ...addForm, tags: e.target.value })}
                            />
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => { setAddForm(null); setAddFormSuiteId(null); }}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1 bg-[#7c3aed] hover:bg-[#6d28d9]"
                                onClick={submitAddForm}
                                disabled={!addForm.title.trim() || createTestCase.isPending}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {createTestCase.isPending ? 'Creating...' : 'Add Test Case'}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-[#7c3aed] hover:text-[#6d28d9] hover:bg-[#f5f3ff]"
                            onClick={() => openAddForm(suiteId)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Test Case
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Monaco Editor Dialog */}
      {editorTestCase && (
        <TestCaseEditor
          testCase={editorTestCase}
          onSave={handleCodeSave}
          onClose={() => setEditorTestCase(null)}
          isSaving={updateTestCase.isPending}
        />
      )}
    </div>
  );
}
