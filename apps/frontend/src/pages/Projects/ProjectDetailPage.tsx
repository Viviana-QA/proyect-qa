import { useParams, Link } from 'react-router';
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
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id!);
  const { data: suites } = useTestSuites(id!);
  const { data: runs } = useTestRuns(id!);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (!project) return <p className="text-destructive">Project not found</p>;

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
              <h1 className="text-xl font-semibold text-[#495057]">{project.name}</h1>
              <div className="mt-2 flex items-center gap-3">
                <a
                  href={project.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-[#405189]"
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
                className="h-8 gap-1.5 bg-[rgba(64,81,137,0.1)] text-[#405189] hover:bg-[rgba(64,81,137,0.2)] border-0 shadow-none"
              >
                <Brain className="h-3.5 w-3.5" />
                Generate Tests with AI
              </Button>
            </Link>
            <Link to={`/projects/${id}/test-cases`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(41,156,219,0.1)] text-[#299cdb] hover:bg-[rgba(41,156,219,0.2)] border-0 shadow-none"
              >
                <TestTube2 className="h-3.5 w-3.5" />
                Test Cases
              </Button>
            </Link>
            <Link to={`/projects/${id}/run`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(10,179,156,0.1)] text-[#0ab39c] hover:bg-[rgba(10,179,156,0.2)] border-0 shadow-none"
              >
                <Play className="h-3.5 w-3.5" />
                Run Tests
              </Button>
            </Link>
            <Link to={`/projects/${id}/reports`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-[rgba(247,184,75,0.1)] text-[#f7b84b] hover:bg-[rgba(247,184,75,0.2)] border-0 shadow-none"
              >
                <FileBarChart className="h-3.5 w-3.5" />
                Reports
              </Button>
            </Link>
            <Link to={`/projects/${id}/jira`}>
              <Button
                size="sm"
                className="h-8 gap-1.5 bg-secondary text-secondary-foreground hover:bg-secondary/80 border-0 shadow-none"
              >
                <Bug className="h-3.5 w-3.5" />
                Jira Config
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Suites"
          value={suites?.length ?? 0}
          icon={Layers}
          iconBg="rgba(64,81,137,0.15)"
          iconColor="#405189"
          subtitle="Test suites"
        />
        <StatCard
          title="Total Runs"
          value={totalRuns}
          icon={Activity}
          iconBg="rgba(41,156,219,0.15)"
          iconColor="#299cdb"
          subtitle="All time"
        />
        <StatCard
          title="Pass Rate"
          value={totalRuns > 0 ? `${passRate}%` : '--'}
          icon={BarChart3}
          iconBg="rgba(10,179,156,0.15)"
          iconColor="#0ab39c"
          subtitle="Completed runs"
        />
        <StatCard
          title="Last Run"
          value={lastRun ? formatTimeAgo(lastRun.created_at) : '--'}
          icon={Clock}
          iconBg="rgba(247,184,75,0.15)"
          iconColor="#f7b84b"
          subtitle={lastRun ? lastRun.status : 'No runs yet'}
        />
      </div>

      {/* Test Suites */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold text-[#495057]">
            Test Suites ({suites?.length ?? 0})
          </CardTitle>
          <Link to={`/projects/${id}/test-cases`} className="text-xs font-medium text-[#405189] hover:underline">
            View All
          </Link>
        </CardHeader>
        <CardContent>
          {!suites?.length ? (
            <div className="py-6 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No test suites yet. Generate tests with AI or create them manually.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Source</th>
                    <th className="pb-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {suites.map((suite) => (
                    <tr key={suite.id} className="transition-colors hover:bg-[#f3f3f9]/60">
                      <td className="py-3 pr-4 font-medium text-[#495057]">{suite.name}</td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="text-xs capitalize">
                          {suite.test_type}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        {suite.is_ai_generated ? (
                          <Badge variant="successSoft">AI Generated</Badge>
                        ) : (
                          <Badge variant="secondary">Manual</Badge>
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
          <CardTitle className="text-base font-semibold text-[#495057]">Recent Test Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentRuns.length ? (
            <div className="py-6 text-center">
              <Play className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No test runs yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Browser</th>
                    <th className="pb-3 pr-4">Pass / Fail / Skip</th>
                    <th className="pb-3 pr-4">Duration</th>
                    <th className="pb-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="transition-colors hover:bg-[#f3f3f9]/60">
                      <td className="py-3 pr-4">
                        <Link to={`/test-runs/${run.id}`}>
                          <StatusBadge status={run.status} />
                        </Link>
                      </td>
                      <td className="py-3 pr-4 capitalize text-[#495057]">{run.browser}</td>
                      <td className="py-3 pr-4">
                        <span className="text-[#0ab39c] font-medium">{run.passed}</span>
                        {' / '}
                        <span className="text-[#f06548] font-medium">{run.failed}</span>
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
  switch (environment) {
    case 'development':
      return <Badge variant="info">Development</Badge>;
    case 'staging':
      return <Badge variant="warning">Staging</Badge>;
    case 'production':
      return <Badge variant="success">Production</Badge>;
    default:
      return <Badge variant="secondary">{environment}</Badge>;
  }
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
