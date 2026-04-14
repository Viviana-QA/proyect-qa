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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#495057]">{t('dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Link to="/projects/new">
          <Button className="bg-[#405189] hover:bg-[#405189]/90">
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.newProject')}
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t('dashboard.totalProjects')}
          value={projects?.length ?? 0}
          icon={FolderKanban}
          iconBg="rgba(64,81,137,0.15)"
          iconColor="#405189"
          subtitle={t('dashboard.activeProjects')}
        />
        <StatCard
          title={t('dashboard.testCases')}
          value="--"
          icon={TestTube2}
          iconBg="rgba(10,179,156,0.15)"
          iconColor="#0ab39c"
          subtitle={t('dashboard.acrossAllProjects')}
        />
        <StatCard
          title={t('dashboard.testsPassed')}
          value="--"
          icon={CheckCircle2}
          iconBg="rgba(10,179,156,0.15)"
          iconColor="#0ab39c"
          subtitle={t('dashboard.last30Days')}
        />
        <StatCard
          title={t('dashboard.testsFailed')}
          value="--"
          icon={XCircle}
          iconBg="rgba(240,101,72,0.15)"
          iconColor="#f06548"
          subtitle={t('dashboard.last30Days')}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-[#495057]">{t('dashboard.quickActions')}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link to={projects?.[0] ? `/projects/${projects[0].id}/generate` : '/projects/new'}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(64,81,137,0.15)' }}
                >
                  <Brain className="h-5 w-5" style={{ color: '#405189' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#495057]">{t('dashboard.generateAITests')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.generateAITestsDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={projects?.[0] ? `/projects/${projects[0].id}/run` : '/projects/new'}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(10,179,156,0.15)' }}
                >
                  <RotateCcw className="h-5 w-5" style={{ color: '#0ab39c' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#495057]">{t('dashboard.runRegression')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.runRegressionDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to={projects?.[0] ? `/projects/${projects[0].id}/reports` : '/projects/new'}>
            <Card className="cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
                  style={{ backgroundColor: 'rgba(247,184,75,0.15)' }}
                >
                  <FileBarChart className="h-5 w-5" style={{ color: '#f7b84b' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#495057]">{t('dashboard.viewReports')}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.viewReportsDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-[#495057]">{t('dashboard.recentProjects')}</CardTitle>
          <Link to="/projects" className="text-xs font-medium text-[#405189] hover:underline">
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
                <Button variant="outline" className="mt-4">
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
                    <tr key={project.id} className="transition-colors hover:bg-[#f3f3f9]/60">
                      <td className="py-3 pr-4 font-medium text-[#495057]">{project.name}</td>
                      <td className="py-3 pr-4">
                        <a
                          href={project.base_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-muted-foreground hover:text-[#405189]"
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
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-[#405189]">
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

      {/* Recent Test Runs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-[#495057]">{t('dashboard.recentTestRuns')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-6 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('dashboard.noTestRunsYet')}</p>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.runFirstTest')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
