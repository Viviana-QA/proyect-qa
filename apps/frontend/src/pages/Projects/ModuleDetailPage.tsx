import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/hooks/use-projects';
import { useModule, useUpdateTestCase, type TestCaseSummary } from '@/hooks/use-modules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TestCaseEditor } from '@/components/test-editor/TestCaseEditor';
import {
  ArrowLeft,
  Globe,
  Box,
  Code,
  TestTube2,
  Pencil,
} from 'lucide-react';

export function ModuleDetailPage() {
  const { t } = useTranslation();
  const { projectId, moduleId } = useParams<{
    projectId: string;
    moduleId: string;
  }>();
  const { data: project } = useProject(projectId!);
  const { data: module, isLoading } = useModule(moduleId!);
  const updateTestCase = useUpdateTestCase();
  const [editingTestCase, setEditingTestCase] = useState<TestCaseSummary | null>(null);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!module) {
    return <p className="text-destructive">{t('projects.projectNotFound')}</p>;
  }

  const testCases = module.test_suite?.test_cases ?? [];

  const handleSave = async (code: string) => {
    if (!editingTestCase) return;
    await updateTestCase.mutateAsync({
      id: editingTestCase.id,
      dto: { playwright_code: code },
    });
    setEditingTestCase(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}/modules`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Box className="h-5 w-5 text-[#7c3aed]" />
            <h1 className="text-xl font-semibold text-[#1e1b4b]">
              {module.name}
            </h1>
          </div>
          {project && (
            <p className="text-sm text-muted-foreground">{project.name}</p>
          )}
        </div>
      </div>

      {/* Module Info */}
      <Card>
        <CardContent className="p-6">
          {module.description && (
            <p className="mb-4 text-sm text-muted-foreground">
              {module.description}
            </p>
          )}
          {module.discovered_urls?.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#1e1b4b]">
                <Globe className="h-4 w-4 text-[#8b5cf6]" />
                {t('modules.discoveredUrls')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {module.discovered_urls.map((url, idx) => (
                  <Badge key={idx} variant="outline" className="font-mono text-xs">
                    {url}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Cases */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#1e1b4b]">
            <TestTube2 className="h-4 w-4 text-[#7c3aed]" />
            {t('modules.testCases')} ({testCases.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {testCases.length === 0 ? (
            <div className="py-8 text-center">
              <Code className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {t('modules.noTestCases')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {testCases.map((tc) => (
                <TestCaseRow
                  key={tc.id}
                  testCase={tc}
                  onEdit={() => setEditingTestCase(tc)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monaco Editor Dialog */}
      {editingTestCase && (
        <TestCaseEditor
          testCase={editingTestCase}
          onSave={handleSave}
          onClose={() => setEditingTestCase(null)}
          isSaving={updateTestCase.isPending}
        />
      )}
    </div>
  );
}

function TestCaseRow({
  testCase,
  onEdit,
}: {
  testCase: TestCaseSummary;
  onEdit: () => void;
}) {
  const { t } = useTranslation();

  const priorityVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
    critical: 'destructive',
    high: 'warning',
    medium: 'info',
    low: 'secondary',
  };

  const statusVariant: Record<string, 'success' | 'secondary' | 'warning' | 'destructive'> = {
    active: 'success',
    draft: 'secondary',
    review: 'warning',
    deprecated: 'destructive',
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-[#f5f3ff]/60">
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-[#1e1b4b]">{testCase.title}</h4>
        {testCase.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
            {testCase.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="info" className="text-[10px] uppercase">
            {testCase.test_type}
          </Badge>
          <Badge
            variant={priorityVariant[testCase.priority] ?? 'secondary'}
            className="text-[10px] capitalize"
          >
            {testCase.priority}
          </Badge>
          <Badge
            variant={statusVariant[testCase.status] ?? 'secondary'}
            className="text-[10px] capitalize"
          >
            {testCase.status}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="ml-4 gap-1.5 text-[#7c3aed] hover:bg-[#7c3aed]/10 hover:text-[#7c3aed]"
        onClick={onEdit}
      >
        <Pencil className="h-3.5 w-3.5" />
        {t('common.edit')}
      </Button>
    </div>
  );
}
