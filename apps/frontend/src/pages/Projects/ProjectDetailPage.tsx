import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/hooks/use-projects';
import { useTestSuites } from '@/hooks/use-test-cases';
import { useTestRuns } from '@/hooks/use-test-runs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import {
  TestTube2,
  Play,
  Brain,
  ExternalLink,
  FileBarChart,
  Bug,
  Layers,
  BarChart3,
  Clock,
  Activity,
} from 'lucide-react';

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id!);
  const { data: suites } = useTestSuites(id!);
  const { data: runs } = useTestRuns(id!);

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('projects.loading')}</p>;
  if (!project) return <p className="text-destructive">{t('projects.projectNotFound')}</p>;

  const recentRuns = runs?.slice(0, 5) ?? [];
  const totalRuns = runs?.length ?? 0;
  const passedRuns = runs?.filter((r) => r.status === 'completed').length ?? 0;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;
  const lastRun = runs?.[0];

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#1e1b4b]">{project.name}</h1>
              <div className="mt-2 flex items-center gap-3">
                <a
                  href={project.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[#7c3aed]"
                >
                  <ExternalLink className="h-3 w-3" />
                  {project.base_url}
                </a>
                <EnvironmentBadge environment={project.environment} />
              </div>
              {project.description && (
                <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
              )}
            </div>
          </div>

          {/* Action buttons row */}
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={`/projects/${id}/generate`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(124,58,237,0.1)] text-[#7c3aed] hover:bg-[rgba(124,58,237,0.2)] border-0 shadow-none"
              >
                <Brain className="h-3.5 w-3.5" />
                {t('projects.generateTestsWithAI')}
              </Button>
            </Link>
            <Link to={`/projects/${id}/test-cases`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(139,92,246,0.1)] text-[#8b5cf6] hover:bg-[rgba(139,92,246,0.2)] border-0 shadow-none"
              >
                <TestTube2 className="h-3.5 w-3.5" />
                {t('projects.testCases')}
              </Button>
            </Link>
            <Link to={`/projects/${id}/run`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(16,185,129,0.1)] text-[#10b981] hover:bg-[rgba(16,185,129,0.2)] border-0 shadow-none"
              >
                <Play className="h-3.5 w-3.5" />
                {t('projects.runTests')}
              </Button>
            </Link>
            <Link to={`/projects/${id}/reports`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(245,158,11,0.1)] text-[#f59e0b] hover:bg-[rgba(245,158,11,0.2)] border-0 shadow-none"
              >
                <FileBarChart className="h-3.5 w-3.5" />
                {t('projects.reports')}
              </Button>
            </Link>
            <Link to={`/projects/${id}/jira`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 border-0 shadow-none"
              >
                <Bug className="h-3.5 w-3.5" />
                {t('projects.jiraConfig')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('projects.totalSuites')}
          value={suites?.length ?? 0}
          icon={Layers}
          iconBg="rgba(124,58,237,0.15)"
          iconColor="#7c3aed"
          subtitle={t('projects.testSuitesSubtitle')}
        />
        <StatCard
          title={t('projects.totalRuns')}
          value={totalRuns}
          icon={Activity}
          iconBg="rgba(139,92,246,0.15)"
          iconColor="#8b5cf6"
          subtitle={t('projects.allTime')}
        />
        <StatCard
          title={t('projects.passRate')}
          value={totalRuns > 0 ? `${passRate}%` : '--'}
          icon={BarChart3}
          iconBg="rgba(16,185,129,0.15)"
          iconColor="#10b981"
          subtitle={t('projects.completedRuns')}
        />
        <StatCard
          title={t('projects.lastRun')}
          value={lastRun ? formatTimeAgo(lastRun.created_at, t) : '--'}
          icon={Clock}
          iconBg="rgba(245,158,11,0.15)"
          iconColor="#f59e0b"
          subtitle={lastRun ? lastRun.status : t('projects.noRunsYet')}
        />
      </div>

      {/* Test Suites */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-[#1e1b4b]">
            {t('projects.testSuites', { count: suites?.length ?? 0 })}
          </CardTitle>
          <Link to={`/projects/${id}/test-cases`} className="text-xs font-medium text-[#7c3aed] hover:underline">
            {t('projects.viewAll')}
          </Link>
        </CardHeader>
        <CardContent>
          {!suites?.length ? (
            <div className="py-6 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {t('projects.noTestSuitesYet')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">{t('projects.tableHeaderName')}</th>
                    <th className="pb-3 pr-4">{t('projects.tableHeaderType')}</th>
                    <th className="pb-3 pr-4">{t('projects.tableHeaderSource')}</th>
                    <th className="pb-3 text-right">{t('projects.tableHeaderCreated')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suites.map((suite) => (
                    <tr key={suite.id} className="transition-colors hover:bg-[#f5f3ff]/60">
                      <td className="py-3 pr-4 font-medium text-[#1e1b4b]">{suite.name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="text-xs capitalize">
                          {suite.test_type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {suite.is_ai_generated ? (
                          <Badge variant="successSoft">{t('projects.aiGenerated')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('projects.manual')}</Badge>
                        )}
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground">
                        {new Date(suite.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Test Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-[#1e1b4b]">{t('projects.recentTestRuns')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentRuns.length ? (
            <div className="py-6 text-center">
              <Play className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('projects.noTestRunsYet')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">{t('projects.tableHeaderStatus')}</th>
                    <th className="pb-3 pr-4">{t('projects.tableHeaderBrowser')}</th>
                    <th className="pb-3 pr-4">{t('projects.tableHeaderPassFailSkip')}</th>
                    <th className="pb-3 pr-4">{t('projects.tableHeaderDuration')}</th>
                    <th className="pb-3 text-right">{t('projects.tableHeaderDate')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="transition-colors hover:bg-[#f5f3ff]/60">
                      <td className="py-3 pr-4">
                        <Link to={`/test-runs/${run.id}`}>
                          <StatusBadge status={run.status} />
                        </Link>
                      </td>
                      <td className="py-3 pr-4 capitalize text-[#1e1b4b]">{run.browser}</td>
                      <td className="py-3 pr-4">
                        <span className="text-[#10b981] font-medium">{run.passed}</span>
                        {' / '}
                        <span className="text-[#ef4444] font-medium">{run.failed}</span>
                        {' / '}
                        <span className="text-muted-foreground">{run.skipped}</span>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '--'}
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'secondary' | 'info'> = {
    pending: 'secondary',
    queued: 'secondary',
    running: 'warning',
    completed: 'success',
    failed: 'destructive',
    cancelled: 'info',
  };
  return <Badge variant={variants[status] || 'secondary'} className="capitalize">{status}</Badge>;
}

function EnvironmentBadge({ environment }: { environment: string }) {
  const { t } = useTranslation();
  switch (environment) {
    case 'development':
      return <Badge variant="info">{t('common.development')}</Badge>;
    case 'staging':
      return <Badge variant="warning">{t('common.staging')}</Badge>;
    case 'production':
      return <Badge variant="success">{t('common.production')}</Badge>;
    default:
      return <Badge variant="secondary">{environment}</Badge>;
  }
}

function formatTimeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t('projects.justNow');
  if (diffMins < 60) return t('projects.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('projects.hoursAgo', { count: diffHours });
  if (diffDays < 7) return t('projects.daysAgo', { count: diffDays });
  return date.toLocaleDateString();
}
