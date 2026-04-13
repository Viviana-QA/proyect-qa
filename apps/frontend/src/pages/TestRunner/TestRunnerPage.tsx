import { useState } from 'react';
import { useParams } from 'react-router';
import { useTestRuns, useCreateTestRun } from '@/hooks/use-test-runs';
import { useTestSuites } from '@/hooks/use-test-cases';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function TestRunnerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: suites } = useTestSuites(projectId!);
  const { data: runs, isLoading } = useTestRuns(projectId!);
  const createRun = useCreateTestRun(projectId!);
  const [selectedSuite, setSelectedSuite] = useState('');
  const [browser, setBrowser] = useState('chromium');

  const handleRunTests = async () => {
    await createRun.mutateAsync({
      suite_id: selectedSuite || undefined,
      browser,
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Test Runner</h1>

      {/* Run Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start New Test Run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Test Suite</label>
              <select
                value={selectedSuite}
                onChange={(e) => setSelectedSuite(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">All Active Tests</option>
                {suites?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Browser</label>
              <select
                value={browser}
                onChange={(e) => setBrowser(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit (Safari)</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleRunTests}
                disabled={createRun.isPending}
                className="w-full"
              >
                {createRun.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Tests
              </Button>
            </div>
          </div>
          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Make sure the QA Agent is running locally: <code className="rounded bg-background px-1">qa-agent start</code>
          </div>
        </CardContent>
      </Card>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Test Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : !runs?.length ? (
            <p className="text-sm text-muted-foreground">No test runs yet.</p>
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
                        <Badge variant="secondary">{run.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(run.created_at).toLocaleString()}
                        {run.duration_ms && ` - ${(run.duration_ms / 1000).toFixed(1)}s`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">{run.passed} passed</span>
                    <span className="text-red-600">{run.failed} failed</span>
                    <span className="text-muted-foreground">{run.skipped} skipped</span>
                    <span className="font-medium">{run.total_tests} total</span>
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
