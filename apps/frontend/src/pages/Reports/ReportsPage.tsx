import { useParams, Link } from 'react-router';
import { useReports } from '@/hooks/use-reports';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, ArrowRight } from 'lucide-react';

export function ReportsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: reports, isLoading } = useReports(projectId!);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : !reports?.length ? (
        <div className="py-12 text-center">
          <FileBarChart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            No reports yet. Reports are generated after test runs complete.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{report.title}</p>
                  <div className="mt-1 flex items-center gap-3 text-sm">
                    <span className="text-green-600">
                      {report.summary.passed} passed
                    </span>
                    <span className="text-red-600">
                      {report.summary.failed} failed
                    </span>
                    <Badge variant="secondary">
                      {report.summary.pass_rate}% pass rate
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(report.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <Link to={`/reports/${report.id}`}>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
