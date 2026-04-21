import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateTestCase } from '@/hooks/use-test-cases';
import { useCompleteTestCase } from '@/hooks/use-ai';
import type { TestType, TestPriority, CreateTestCaseDto } from '@qa/shared-types';

const TEST_TYPES: TestType[] = [
  'e2e', 'regression', 'visual', 'accessibility',
  'performance', 'api', 'cross_browser', 'responsive',
];

const PRIORITIES: TestPriority[] = ['low', 'medium', 'high', 'critical'];

const DEFAULT_CODE = `import { test, expect } from '@playwright/test';

test('new test', async ({ page }) => {
  await page.goto('/');
});`;

interface Props {
  suiteId: string;
  projectId: string;
  onClose: () => void;
}

type Tab = 'manual' | 'ai';

export function AddTestCaseModal({ suiteId, projectId, onClose }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('manual');

  // ── Manual tab state ────────────────────────────────────────────
  const [manualTitle, setManualTitle] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualType, setManualType] = useState<TestType>('e2e');
  const [manualPriority, setManualPriority] = useState<TestPriority>('medium');
  const [manualCode, setManualCode] = useState(DEFAULT_CODE);
  const [manualTags, setManualTags] = useState('');

  // ── AI tab state ─────────────────────────────────────────────────
  const [aiSpec, setAiSpec] = useState('');
  const [aiType, setAiType] = useState<TestType>('e2e');
  const [aiPriority, setAiPriority] = useState<TestPriority>('medium');
  const [aiTitle, setAiTitle] = useState('');
  const [aiCode, setAiCode] = useState('');
  const [aiTags, setAiTags] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiGenerated, setAiGenerated] = useState(false);

  const createTestCase = useCreateTestCase(projectId);
  const completeTestCase = useCompleteTestCase();

  // ── Handlers ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!aiSpec.trim()) return;
    setAiError('');
    setAiGenerated(false);
    try {
      const res = await completeTestCase.mutateAsync({
        project_id: projectId,
        suite_id: suiteId,
        description: aiSpec.trim(),
        test_type: aiType,
        priority: aiPriority,
      });
      const tc = res.test_case;
      setAiTitle(tc.title || '');
      setAiCode(tc.playwright_code || '');
      setAiTags((tc.tags || []).join(', '));
      setAiGenerated(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAiError(message || t('addTestCaseModal.generationError'));
    }
  };

  const handleSave = () => {
    let dto: CreateTestCaseDto;

    if (tab === 'manual') {
      if (!manualTitle.trim()) return;
      dto = {
        suite_id: suiteId,
        title: manualTitle.trim(),
        description: manualDesc.trim() || undefined,
        test_type: manualType,
        priority: manualPriority,
        playwright_code: manualCode,
        tags: manualTags.split(',').map((s) => s.trim()).filter(Boolean),
      };
    } else {
      if (!aiGenerated || !aiTitle.trim()) return;
      dto = {
        suite_id: suiteId,
        title: aiTitle.trim(),
        description: aiSpec.trim() || undefined,
        test_type: aiType,
        priority: aiPriority,
        playwright_code: aiCode,
        tags: aiTags.split(',').map((s) => s.trim()).filter(Boolean),
      };
    }

    createTestCase.mutate(dto, { onSuccess: onClose });
  };

  const canSave =
    tab === 'manual'
      ? !!manualTitle.trim() && !createTestCase.isPending
      : aiGenerated && !!aiTitle.trim() && !createTestCase.isPending;

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <h2 className="text-lg font-semibold text-[#1e1b4b]">
            {t('addTestCaseModal.title')}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab('manual')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'manual'
                ? 'border-[#7c3aed] text-[#7c3aed]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('addTestCaseModal.tabManual')}
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`flex items-center gap-1.5 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ai'
                ? 'border-[#7c3aed] text-[#7c3aed]'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('addTestCaseModal.tabAI')}
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

          {tab === 'manual' && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('addTestCaseModal.titleLabel')} *</label>
                <Input
                  placeholder={t('addTestCaseModal.titlePlaceholder')}
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('addTestCaseModal.descriptionLabel')}</label>
                <Textarea
                  placeholder={t('testCasesPage.descriptionPlaceholder')}
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('testCasesPage.type')}</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as TestType)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TEST_TYPES.map((tt) => (
                      <option key={tt} value={tt}>{tt.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('testCasesPage.priority')}</label>
                  <select
                    value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value as TestPriority)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('testCasesPage.playwrightCode')}</label>
                <Textarea
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>
              <Input
                placeholder={t('addTestCaseModal.tagsPlaceholder')}
                value={manualTags}
                onChange={(e) => setManualTags(e.target.value)}
              />
            </>
          )}

          {tab === 'ai' && (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  {t('addTestCaseModal.aiDescriptionLabel')} *
                </label>
                <Textarea
                  placeholder={t('addTestCaseModal.aiDescriptionPlaceholder')}
                  value={aiSpec}
                  onChange={(e) => { setAiSpec(e.target.value); setAiError(''); }}
                  rows={3}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('testCasesPage.type')}</label>
                  <select
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value as TestType)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TEST_TYPES.map((tt) => (
                      <option key={tt} value={tt}>{tt.replace('_', ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t('testCasesPage.priority')}</label>
                  <select
                    value={aiPriority}
                    onChange={(e) => setAiPriority(e.target.value as TestPriority)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!aiSpec.trim() || completeTestCase.isPending}
                className="w-full gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
              >
                {completeTestCase.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('addTestCaseModal.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t('addTestCaseModal.generateBtn')}
                  </>
                )}
              </Button>

              {aiError && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiGenerated && (
                <div className="space-y-3 rounded-lg border border-[#7c3aed]/30 bg-[#f5f3ff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#7c3aed]">
                    {t('addTestCaseModal.generatedCodeLabel')}
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('addTestCaseModal.titleLabel')}</label>
                    <Input
                      value={aiTitle}
                      onChange={(e) => setAiTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">{t('testCasesPage.playwrightCode')}</label>
                    <Textarea
                      value={aiCode}
                      onChange={(e) => setAiCode(e.target.value)}
                      rows={10}
                      className="font-mono text-xs bg-white"
                    />
                  </div>
                  <Input
                    placeholder={t('addTestCaseModal.tagsPlaceholder')}
                    value={aiTags}
                    onChange={(e) => setAiTags(e.target.value)}
                    className="bg-white"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-6 py-4 shrink-0">
          <Button variant="outline" onClick={onClose}>
            {t('addTestCaseModal.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9]"
          >
            {createTestCase.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('addTestCaseModal.saving')}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {t('addTestCaseModal.save')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
