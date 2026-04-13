import { useParams } from 'react-router';
import { useReport } from '@/hooks/use-reports';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: report, isLoading } = useReport(id!);

  if (isLoading) return <p className="text-muted-foreground">Loading report...</p>;
  if (!report) return <p className="text-destructive">Report not found</p>;

  const { summary } = report;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{report.title}</h1>
        <p className="text-muted-foreground">
          Generated on {new Date(report.created_at).toLocaleString()}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold">{summary.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-green-600">Passed</p>
            <p className="text-3xl font-bold text-green-600">{summary.passed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-red-600">Failed</p>
            <p className="text-3xl font-bold text-red-600">{summary.failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Skipped</p>
            <p className="text-3xl font-bold">{summary.skipped}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Pass Rate</p>
            <p className="text-3xl font-bold">
              <span className={summary.pass_rate >= 80 ? 'text-green-600' : 'text-red-600'}>
                {summary.pass_rate}%
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Run Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Browser</span>
            <span>{summary.browser}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration</span>
            <span>{(summary.duration_ms / 1000).toFixed(1)}s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Test Types</span>
            <div className="flex gap-1">
              {summary.test_types.map((t) => (
                <Badge key={t} variant="outline">{t}</Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Summary */}
      {report.report_data.accessibility_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Accessibility Violations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">
              {report.report_data.accessibility_summary.total_violations} violations
            </p>
            <div className="mt-3 flex gap-4">
              {Object.entries(report.report_data.accessibility_summary.by_impact).map(
                ([impact, count]) => (
                  <div key={impact} className="text-sm">
                    <Badge
                      variant={
                        impact === 'critical' ? 'destructive' :
                        impact === 'serious' ? 'warning' : 'secondary'
                      }
                    >
                      {impact}: {count as number}
                    </Badge>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Summary */}
      {report.report_data.performance_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                { label: 'LCP', value: report.report_data.performance_summary.avg_lcp_ms, unit: 'ms', threshold: 2500 },
                { label: 'FCP', value: report.report_data.performance_summary.avg_fcp_ms, unit: 'ms', threshold: 1800 },
                { label: 'CLS', value: report.report_data.performance_summary.avg_cls, unit: '', threshold: 0.1 },
                { label: 'TTFB', value: report.report_data.performance_summary.avg_ttfb_ms, unit: 'ms', threshold: 800 },
              ].map((metric) => (
                <div key={metric.label} className="text-center">
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p
                    className={`text-2xl font-bold ${
                      metric.value != null && metric.value <= metric.threshold
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {metric.value != null ? `${metric.value}${metric.unit}` : '--'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
