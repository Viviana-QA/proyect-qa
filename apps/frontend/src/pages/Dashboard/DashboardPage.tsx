import { useProjects } from '@/hooks/use-projects';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { Link } from 'react-router';
import {
  FolderKanban,
  TestTube2,
  CheckCircle2,
  XCircle,
  Plus,
  ArrowRight,
  Brain,
  RotateCcw,
  FileBarChart,
  ExternalLink,
  Clock,
  Monitor,
  PlayCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/* Sample chart data — will be replaced with real data later */
const chartData = [
  { date: 'Mon', passed: 12, failed: 2 },
  { date: 'Tue', passed: 18, failed: 3 },
  { date: 'Wed', passed: 15, failed: 1 },
  { date: 'Thu', passed: 22, failed: 4 },
  { date: 'Fri', passed: 20, failed: 2 },
  { date: 'Sat', passed: 8, failed: 0 },
  { date: 'Sun', passed: 25, failed: 3 },
];

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();

  /* Determine latest test run status – placeholder until real hook is wired */
  const latestRunStatus: 'empty' | 'running' | 'completed' | 'failed' | 'queued' = 'empty';

  return (
    <div className="space-y-6">
      {/* ───── Header ───── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1e1b4b]">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Link to="/projects/new">
          <Button className="bg-[#7c3aed] hover:bg-[#7c3aed]/90 shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.newProject')}
          </Button>
        </Link>
      </div>

      {/* ───── KPI Cards with Trends ───── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('dashboard.totalProjects')}
          value={projects?.length ?? 0}
          icon={FolderKanban}
          iconBg="rgba(124,58,237,0.15)"
          iconColor="#7c3aed"
          change={{ value: 16.24, type: 'up' }}
          subtitle={t('dashboard.activeProjects')}
        />
        <StatCard
          title={t('dashboard.testCases')}
          value="--"
          icon={TestTube2}
          iconBg="rgba(16,185,129,0.15)"
          iconColor="#10b981"
          change={{ value: 8.12, type: 'up' }}
          subtitle={t('dashboard.acrossAllProjects')}
        />
        <StatCard
          title={t('dashboard.testsPassed')}
          value="--"
          icon={CheckCircle2}
          iconBg="rgba(139,92,246,0.15)"
          iconColor="#8b5cf6"
          change={{ value: 12.5, type: 'up' }}
          subtitle={t('dashboard.last30Days')}
        />
        <StatCard
          title={t('dashboard.testsFailed')}
          value="--"
          icon={XCircle}
          iconBg="rgba(239,68,68,0.15)"
          iconColor="#ef4444"
          change={{ value: 3.96, type: 'down' }}
          subtitle={t('dashboard.last30Days')}
        />
      </div>

      {/* ───── Quick Actions (premium cards) ───── */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[#1e1b4b]">{t('dashboard.quickActions')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Primary action – purple gradient */}
          <Link to={projects?.[0] ? `/projects/${projects[0].id}/generate` : '/projects/new'}>
            <Card className="group cursor-pointer border-0 bg-gradient-to-br from-[#7c3aed] to-[#5b21b6] text-white transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-200">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('dashboard.generateAITests')}</p>
                  <p className="text-xs text-white/75">{t('dashboard.generateAITestsDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={projects?.[0] ? `/projects/${projects[0].id}/run` : '/projects/new'}>
            <Card className="group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-100">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgba(16,185,129,0.15)' }}
                >
                  <RotateCcw className="h-6 w-6" style={{ color: '#10b981' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.runRegression')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.runRegressionDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to={projects?.[0] ? `/projects/${projects[0].id}/reports` : '/projects/new'}>
            <Card className="group cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-100">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}
                >
                  <FileBarChart className="h-6 w-6" style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.viewReports')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.viewReportsDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* ───── Recent Projects ───── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-[#1e1b4b]">{t('dashboard.recentProjects')}</CardTitle>
          <Link to="/projects" className="text-xs font-medium text-[#7c3aed] hover:underline">
            {t('dashboard.viewAll')}
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('dashboard.loadingProjects')}</p>
          ) : projects?.length === 0 ? (
            <div className="py-8 text-center">
              <FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">{t('dashboard.noProjectsYet')}</p>
              <Link to="/projects/new">
                <Button variant="outline" className="mt-4 border-[#7c3aed] text-[#7c3aed] hover:bg-[#f5f3ff]">
                  <Plus className="mr-2 h-4 w-4" />
                  {t('dashboard.createFirstProject')}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">{t('dashboard.tableHeaderName')}</th>
                    <th className="pb-3 pr-4">{t('dashboard.tableHeaderUrl')}</th>
                    <th className="pb-3 pr-4">{t('dashboard.tableHeaderEnvironment')}</th>
                    <th className="pb-3 pr-4">{t('dashboard.tableHeaderStatus')}</th>
                    <th className="pb-3 text-right">{t('dashboard.tableHeaderActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {projects?.slice(0, 5).map((project) => (
                    <tr key={project.id} className="transition-colors hover:bg-[#f5f3ff]">
                      <td className="py-3 pr-4 font-medium text-[#1e1b4b]">{project.name}</td>
                      <td className="py-3 pr-4">
                        <a
                          href={project.base_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground hover:text-[#7c3aed]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span className="max-w-[180px] truncate">{project.base_url}</span>
                        </a>
                      </td>
                      <td className="py-3 pr-4">
                        <EnvironmentBadge environment={project.environment} />
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="successSoft">{t('dashboard.statusActive')}</Badge>
                      </td>
                      <td className="py-3 text-right">
                        <Link to={`/projects/${project.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#7c3aed] hover:bg-[#f5f3ff]">
                            {t('dashboard.view')} <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ───── Test Runs Activity — 2-column layout ───── */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: Area Chart (wider) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#1e1b4b]">
              {t('dashboard.recentTestRuns')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.last30Days')}
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="passed"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fill="url(#purpleGradient)"
                    name="Passed"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#redGradient)"
                    name="Failed"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Mini legend */}
            <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7c3aed]" />
                {t('dashboard.chartPassed')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                {t('dashboard.chartFailed')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right: Test Run Status */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-[#1e1b4b]">
              {t('dashboard.testRunStatusTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TestRunStatus status={latestRunStatus} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   Test Run Status visual states
   ──────────────────────────────────────────── */

function TestRunStatus({
  status,
}: {
  status: 'empty' | 'running' | 'completed' | 'failed' | 'queued';
}) {
  const { t } = useTranslation();

  if (status === 'running') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="relative mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(124,58,237,0.15)]">
            <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
          </div>
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7c3aed] opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#7c3aed]" />
          </span>
        </div>
        <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.runningTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.runningDesc')}</p>
        <div className="mt-4 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-[#f5f3ff]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-[#7c3aed] to-[#a78bfa]" />
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(16,185,129,0.15)]">
          <CheckCircle2 className="h-6 w-6 text-[#10b981]" />
        </div>
        <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.completedTitle')}</p>
        <div className="mt-4 grid w-full grid-cols-3 gap-3">
          <div className="rounded-lg bg-[#f5f3ff] p-2 text-center">
            <p className="text-lg font-bold text-[#7c3aed]">25</p>
            <p className="text-[10px] text-muted-foreground">{t('dashboard.completedTotal')}</p>
          </div>
          <div className="rounded-lg bg-[rgba(16,185,129,0.08)] p-2 text-center">
            <p className="text-lg font-bold text-[#10b981]">22</p>
            <p className="text-[10px] text-muted-foreground">{t('dashboard.completedPassed')}</p>
          </div>
          <div className="rounded-lg bg-[rgba(239,68,68,0.08)] p-2 text-center">
            <p className="text-lg font-bold text-[#ef4444]">3</p>
            <p className="text-[10px] text-muted-foreground">{t('dashboard.completedFailed')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(239,68,68,0.15)]">
          <AlertTriangle className="h-6 w-6 text-[#ef4444]" />
        </div>
        <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.failedTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.failedDesc', { count: 3 })}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-[#ef4444] text-xs text-[#ef4444] hover:bg-red-50"
        >
          {t('dashboard.viewDetails')} <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    );
  }

  if (status === 'queued') {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(245,158,11,0.15)]">
          <Clock className="h-6 w-6 text-[#f59e0b]" />
        </div>
        <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.queuedTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('dashboard.queuedDesc')}</p>
        <p className="mt-3 rounded-md bg-[#f5f3ff] px-3 py-2 text-[11px] text-[#7c3aed]">
          {t('dashboard.parallelTip')}
        </p>
      </div>
    );
  }

  /* status === 'empty' */
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-4 rounded-xl border-2 border-dashed border-[#a78bfa]/40 p-5">
        <PlayCircle className="h-8 w-8 text-[#a78bfa]" />
      </div>
      <p className="text-sm font-semibold text-[#1e1b4b]">{t('dashboard.noTestRunsYet')}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t('dashboard.runFirstTest')}
      </p>
      <Button
        size="sm"
        className="mt-4 bg-[#7c3aed] text-xs shadow-sm hover:bg-[#7c3aed]/90"
      >
        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
        {t('dashboard.runFirstTestButton')}
      </Button>
    </div>
  );
}

/* ────────────────────────────────────────────
   Environment badge helper
   ──────────────────────────────────────────── */

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
