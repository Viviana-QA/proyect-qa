import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/hooks/use-projects';
import { useModules, type AppModule } from '@/hooks/use-modules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Layers,
  TestTube2,
  Globe,
  Box,
  ChevronRight,
} from 'lucide-react';

export function ModulesListPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading: projectLoading } = useProject(projectId!);
  const { data: modules, isLoading: modulesLoading } = useModules(projectId!);

  if (projectLoading || modulesLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!project) {
    return <p className="text-destructive">{t('projects.projectNotFound')}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/projects/${projectId}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#1e1b4b]">
            {t('modules.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('modules.subtitle')} &mdash; {project.name}
          </p>
        </div>
      </div>

      {/* Modules Grid */}
      {!modules?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t('generation.noModules')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <ModuleCard key={mod.id} module={mod} projectId={projectId!} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module,
  projectId,
}: {
  module: AppModule;
  projectId: string;
}) {
  const { t } = useTranslation();
  const testCaseCount = module.test_suite?.test_cases?.length ?? 0;

  return (
    <Link to={`/projects/${projectId}/modules/${module.id}`}>
      <Card className="group cursor-pointer transition-all hover:border-[#7c3aed]/50 hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]/10">
                <Box className="h-4 w-4 text-[#7c3aed]" />
              </div>
              <CardTitle className="text-sm font-semibold text-[#1e1b4b]">
                {module.name}
              </CardTitle>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardHeader>
        <CardContent>
          {module.description && (
            <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
              {module.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <TestTube2 className="h-3.5 w-3.5 text-[#8b5cf6]" />
              <span className="text-xs font-medium text-[#1e1b4b]">
                {testCaseCount} {t('modules.testCases')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5 text-[#8b5cf6]" />
              <span className="text-xs font-medium text-[#1e1b4b]">
                {module.discovered_urls?.length ?? 0} {t('modules.discoveredUrls')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
