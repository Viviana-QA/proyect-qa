import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/hooks/use-projects';
import {
  useGenerationJob,
  useLatestGenerationJob,
  useStartGeneration,
  type JobStatus,
} from '@/hooks/use-generation-jobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  Clock,
  Globe,
  Code,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Sparkles,
  Loader2,
} from 'lucide-react';

const TEST_TYPES = [
  { value: 'e2e', label: 'E2E Testing' },
  { value: 'regression', label: 'Regression Testing' },
  { value: 'visual', label: 'Visual Regression' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'performance', label: 'Performance' },
  { value: 'api', label: 'API Testing' },
];

export function GenerateTestsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: latestJob } = useLatestGenerationJob(id!);
  const startGeneration = useStartGeneration(id!);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(['e2e', 'regression']);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const jobId = activeJobId || (latestJob && latestJob.status !== 'completed' && latestJob.status !== 'failed' ? latestJob.id : null);

  if (projectLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!project) {
    return <p className="text-destructive">{t('projects.projectNotFound')}</p>;
  }

  const handleStart = async () => {
    try {
      const job = await startGeneration.mutateAsync({
        test_types: selectedTypes,
      });
      setActiveJobId(job.id);
    } catch {
      // error handled by mutation state
    }
  };

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value],
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/projects/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-[#1e1b4b]">
            {t('generation.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      {jobId ? (
        <JobProgressTracker
          jobId={jobId}
          projectId={id!}
          onRetry={() => setActiveJobId(null)}
        />
      ) : (
        <GenerationForm
          selectedTypes={selectedTypes}
          onToggleType={toggleType}
          onStart={handleStart}
          isLoading={startGeneration.isPending}
        />
      )}
    </div>
  );
}

function GenerationForm({
  selectedTypes,
  onToggleType,
  onStart,
  isLoading,
}: {
  selectedTypes: string[];
  onToggleType: (value: string) => void;
  onStart: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#1e1b4b]">
          <Sparkles className="h-5 w-5 text-[#7c3aed]" />
          {t('generation.title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('generation.description')}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="mb-3 block text-sm font-medium text-[#1e1b4b]">
            {t('generation.selectTestTypes')}
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TEST_TYPES.map((type) => (
              <label
                key={type.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selectedTypes.includes(type.value)
                    ? 'border-[#7c3aed] bg-[#f5f3ff]'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <Checkbox
                  checked={selectedTypes.includes(type.value)}
                  onCheckedChange={() => onToggleType(type.value)}
                />
                <span className="text-sm font-medium text-[#1e1b4b]">
                  {type.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Button
          onClick={onStart}
          disabled={isLoading || selectedTypes.length === 0}
          className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {t('generation.startGeneration')}
        </Button>
      </CardContent>
    </Card>
  );
}

function JobProgressTracker({
  jobId,
  projectId,
  onRetry,
}: {
  jobId: string;
  projectId: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: job } = useGenerationJob(jobId);

  if (!job) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <ProgressStep
        status={job.status}
        step="pending"
        icon={Clock}
        title={t('generation.pending')}
        description={t('generation.pendingDesc')}
        animationClass="animate-pulse"
      />
      <ProgressStep
        status={job.status}
        step="crawling"
        icon={Globe}
        title={t('generation.crawling')}
        description={t('generation.crawlingDesc')}
        animationClass="animate-spin"
      />
      <ProgressStep
        status={job.status}
        step="analyzing"
        icon={Brain}
        title={t('generation.analyzing')}
        description={t('generation.analyzingDesc')}
        animationClass="animate-pulse"
      />
      <ProgressStep
        status={job.status}
        step="generating"
        icon={Code}
        title={t('generation.generating')}
        description={t('generation.generatingDesc')}
        animationClass=""
        progress={job.status === 'generating' ? 75 : job.status === 'completed' ? 100 : 50}
      />

      {job.status === 'completed' && (
        <Card className="border-[#10b981] bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#10b981]/20">
                <CheckCircle2 className="h-6 w-6 text-[#10b981]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[#1e1b4b]">
                  {t('generation.completed')}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('generation.completedDesc', {
                    modules: job.modules_found,
                    testCases: job.test_cases_generated,
                  })}
                </p>
                <Button
                  onClick={() => navigate(`/projects/${projectId}/modules`)}
                  className="mt-4 gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
                >
                  {t('generation.viewResults')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {job.status === 'failed' && (
        <Card className="border-[#ef4444] bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#ef4444]/20">
                <XCircle className="h-6 w-6 text-[#ef4444]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[#1e1b4b]">
                  {t('generation.failed')}
                </h3>
                {job.error_message && (
                  <p className="mt-1 text-sm text-[#ef4444]">
                    {job.error_message}
                  </p>
                )}
                <Button
                  onClick={onRetry}
                  variant="outline"
                  className="mt-4 gap-2 border-[#ef4444] text-[#ef4444] hover:bg-red-50"
                >
                  {t('generation.retry')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const STEP_ORDER: JobStatus[] = ['pending', 'crawling', 'analyzing', 'generating', 'completed', 'failed'];

function ProgressStep({
  status,
  step,
  icon: Icon,
  title,
  description,
  animationClass,
  progress,
}: {
  status: JobStatus;
  step: JobStatus;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  animationClass: string;
  progress?: number;
}) {
  const currentIdx = STEP_ORDER.indexOf(status);
  const stepIdx = STEP_ORDER.indexOf(step);
  const isActive = status === step;
  const isDone = currentIdx > stepIdx && status !== 'failed';
  const isPending = !isActive && !isDone;

  return (
    <Card
      className={`transition-all duration-300 ${
        isActive
          ? 'border-[#7c3aed] bg-[#f5f3ff] shadow-md'
          : isDone
          ? 'border-[#10b981]/50 bg-green-50/50 opacity-80'
          : 'opacity-50'
      }`}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            isActive
              ? 'bg-[#7c3aed]/20'
              : isDone
              ? 'bg-[#10b981]/20'
              : 'bg-muted'
          }`}
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
          ) : (
            <Icon
              className={`h-5 w-5 ${
                isActive ? `text-[#7c3aed] ${animationClass}` : 'text-muted-foreground'
              }`}
            />
          )}
        </div>
        <div className="flex-1">
          <h4
            className={`text-sm font-semibold ${
              isActive ? 'text-[#7c3aed]' : isDone ? 'text-[#10b981]' : 'text-muted-foreground'
            }`}
          >
            {title}
          </h4>
          <p className="text-xs text-muted-foreground">{description}</p>
          {isActive && step === 'generating' && typeof progress === 'number' && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#7c3aed]/20">
              <div
                className="h-full rounded-full bg-[#7c3aed] transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
        </div>
        {isActive && (
          <Badge variant="info" className="shrink-0">
            {isPending ? '' : isActive ? 'In progress' : ''}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
