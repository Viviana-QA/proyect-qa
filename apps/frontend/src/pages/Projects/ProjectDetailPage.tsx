import { useParams, Link } from 'react-router';
import { useProject } from '@/hooks/use-projects';
import { useTestSuites } from '@/hooks/use-test-cases';
import { useTestRuns } from '@/hooks/use-test-runs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TestTube2,
  Play,
  Brain,
  ExternalLink,
  FileBarChart,
  Bug,
} from 'lucide-react';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading } = useProject(id!);
  const { data: suites } = useTestSuites(id!);
  const { data: runs } = useTestRuns(id!);

  if (isLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (!project) return <p className="text-destructive">Project not found</p>;

  const recentRuns = runs?.slice(0, 5) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-muted-foreground">
            <a
              href={project.base_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary"
            >
              <ExternalLink className="h-3 w-3" />
              {project.base_url}
            </a>
            <Badge variant="secondary">{project.environment}</Badge>
          </div>
          {project.description && (
            <p className="mt-2 text-muted-foreground">{project.description}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to={`/projects/${id}/generate`}>
          <Button>
            <Brain className="mr-2 h-4 w-4" />
            Generate Tests with AI
          </Button>
        </Link>
        <Link to={`/projects/${id}/test-cases`}>
          <Button variant="outline">
            <TestTube2 className="mr-2 h-4 w-4" />
            Test Cases
          </Button>
        </Link>
        <Link to={`/projects/${id}/run`}>
          <Button variant="outline">
            <Play className="mr-2 h-4 w-4" />
            Run Tests
          </Button>
        </Link>
        <Link to={`/projects/${id}/reports`}>
          <Button variant="outline">
            <FileBarChart className="mr-2 h-4 w-4" />
            Reports
          </Button>
        </Link>
        <Link to={`/projects/${id}/jira`}>
          <Button variant="outline">
            <Bug className="mr-2 h-4 w-4" />
            Jira Config
          </Button>
        </Link>
      </div>

      {/* Test Suites */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Suites ({suites?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!suites?.length ? (
            <p className="text-sm text-muted-foreground">
              No test suites yet. Generate tests with AI or create them manually.
            </p>
          ) : (
            <div className="space-y-2">
              {suites.map((suite) => (
                <div
                  key={suite.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{suite.name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{suite.test_type}</Badge>
                      {suite.is_ai_generated && (
                        <Badge variant="secondary">AI Generated</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Test Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {!recentRuns.length ? (
            <p className="text-sm text-muted-foreground">No test runs yet.</p>
          ) : (
            <div className="space-y-2">
              {recentRuns.map((run) => (
                <Link
                  key={run.id}
                  to={`/test-runs/${run.id}`}
                  className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <StatusBadge status={run.status} />
                    <div>
                      <p className="text-sm font-medium">
                        {run.browser} - {run.total_tests} tests
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <span className="text-green-600">{run.passed}P</span>
                    {' / '}
                    <span className="text-red-600">{run.failed}F</span>
                    {' / '}
                    <span className="text-muted-foreground">{run.skipped}S</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'success' | 'destructive' | 'warning' | 'secondary'> = {
    pending: 'secondary',
    queued: 'secondary',
    running: 'warning',
    completed: 'success',
    failed: 'destructive',
    cancelled: 'outline' as any,
  };
  return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
}
