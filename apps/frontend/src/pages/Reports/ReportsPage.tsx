import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useReports } from '@/hooks/use-reports';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, ArrowRight } from 'lucide-react';

export function ReportsPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: reports, isLoading } = useReports(projectId!);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t('reports.title')}</h1>

      {isLoading ? (
        <p className="text-muted-foreground">{t('reports.loading')}</p>
      ) : !reports?.length ? (
        <div className="py-12 text-center">
          <FileBarChart className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            {t('reports.noReportsYet')}
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
                      {t('reports.passed', { count: report.summary.passed })}
                    </span>
                    <span className="text-red-600">
                      {t('reports.failed', { count: report.summary.failed })}
                    </span>
                    <Badge variant="secondary">
                      {t('reports.passRate', { rate: report.summary.pass_rate })}
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
