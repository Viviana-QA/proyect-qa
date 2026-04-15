import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/hooks/use-projects';
import {
  useGenerationJob,
  useLatestGenerationJob,
  useStartGeneration,
  useCancelJob,
  type JobStatus,
  type GenerationJob,
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
  Terminal,
  XOctagon,
  RotateCcw,
  Eye,
  Ban,
  AlertTriangle,
  Copy,
  Check,
  Download,
  Wifi,
  WifiOff,
} from 'lucide-react';

const TEST_TYPES = [
  { value: 'e2e', label: 'E2E Testing' },
  { value: 'regression', label: 'Regression Testing' },
  { value: 'visual', label: 'Visual Regression' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'performance', label: 'Performance' },
  { value: 'api', label: 'API Testing' },
];

const STATUS_PROGRESS: Record<string, number> = {
  pending: 10,
  crawling: 25,
  analyzing: 50,
  generating: 75,
  completed: 100,
  failed: 0,
  cancelled: 0,
};

export function GenerateTestsPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: latestJob } = useLatestGenerationJob(id!);
  const startGeneration = useStartGeneration(id!);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(['e2e', 'regression']);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const isJobActive = (s?: string) => s && !['completed', 'failed', 'cancelled'].includes(s);
  const jobId = activeJobId || (latestJob && isJobActive(latestJob.status) ? latestJob.id : null);
  // Also show completed/failed jobs if they're the latest
  const showJobId = jobId || (latestJob ? latestJob.id : null);

  if (projectLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!project) return <p className="text-destructive">{t('projects.projectNotFound')}</p>;

  const handleStart = async () => {
    try {
      const job = await startGeneration.mutateAsync({ test_types: selectedTypes });
      setActiveJobId(job.id);
    } catch {
      // handled by mutation
    }
  };

  const toggleType = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  const showForm = !showJobId || (latestJob && ['completed', 'failed', 'cancelled'].includes(latestJob.status) && !activeJobId);

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
          <h1 className="text-xl font-semibold text-[#1e1b4b]">{t('generation.title')}</h1>
          <p className="text-sm text-muted-foreground">{project.name} &mdash; {project.base_url}</p>
        </div>
      </div>

      {showForm ? (
        <GenerationForm
          selectedTypes={selectedTypes}
          onToggleType={toggleType}
          onStart={handleStart}
          isLoading={startGeneration.isPending}
        />
      ) : null}

      {showJobId && (
        <JobLiveView
          jobId={showJobId}
          projectId={id!}
          onRetry={() => setActiveJobId(null)}
        />
      )}
    </div>
  );
}

/* ── Generation Form ── */
function GenerationForm({
  selectedTypes, onToggleType, onStart, isLoading,
}: {
  selectedTypes: string[];
  onToggleType: (v: string) => void;
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
        <p className="text-sm text-muted-foreground">{t('generation.description')}</p>
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
                <span className="text-sm font-medium text-[#1e1b4b]">{type.label}</span>
              </label>
            ))}
          </div>
        </div>
        <Button
          onClick={onStart}
          disabled={isLoading || selectedTypes.length === 0}
          className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
          {t('generation.startGeneration')}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Job Live View (status card + setup guide + terminal) ── */
function JobLiveView({
  jobId, projectId, onRetry,
}: {
  jobId: string;
  projectId: string;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: job } = useGenerationJob(jobId);
  const cancelJob = useCancelJob();
  const [pendingTooLong, setPendingTooLong] = useState(false);
  const [pendingSeconds, setPendingSeconds] = useState(0);

  // Detect if job has been pending for too long (agent not running)
  useEffect(() => {
    if (!job || job.status !== 'pending') {
      setPendingTooLong(false);
      setPendingSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      const created = new Date(job.created_at).getTime();
      const elapsed = Math.floor((Date.now() - created) / 1000);
      setPendingSeconds(elapsed);
      if (elapsed > 15) setPendingTooLong(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [job?.id, job?.status, job?.created_at]);

  if (!job) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#7c3aed]" />
        </CardContent>
      </Card>
    );
  }

  const progress = STATUS_PROGRESS[job.status] ?? 0;
  const isActive = !['completed', 'failed', 'cancelled'].includes(job.status);
  const logs = (job.logs as any[]) || [];

  const handleCancel = () => {
    cancelJob.mutate(jobId);
  };

  return (
    <div className="space-y-4">
      {/* Agent Setup Guide - shown when pending too long */}
      {pendingTooLong && job.status === 'pending' && (
        <AgentSetupGuide pendingSeconds={pendingSeconds} />
      )}

      {/* Status Card */}
      <Card className={`border-l-4 ${getStatusBorderColor(job.status)}`}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${getStatusBgColor(job.status)}`}>
              <StatusIcon status={job.status} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-[#1e1b4b]">
                  {getStatusTitle(job.status, t)}
                </h3>
                <Badge variant={getStatusBadgeVariant(job.status)} className="shrink-0">
                  {job.status}
                </Badge>
              </div>

              {/* Current step from DB */}
              {job.current_step && (
                <p className="mt-1 text-sm text-[#7c3aed] font-medium">
                  {job.current_step}
                </p>
              )}

              {/* Progress message fallback */}
              {!job.current_step && job.progress_message && (
                <p className="mt-1 text-sm text-muted-foreground">{job.progress_message}</p>
              )}

              {/* Error message */}
              {job.status === 'failed' && job.error_message && (
                <div className="mt-2 rounded-md bg-red-100 p-3 text-sm text-[#ef4444]">
                  <strong>Error:</strong> {job.error_message}
                </div>
              )}

              {/* Completed summary */}
              {job.status === 'completed' && (
                <p className="mt-1 text-sm text-[#10b981]">
                  {t('generation.completedDesc', {
                    modules: job.modules_found,
                    testCases: job.test_cases_generated,
                  })}
                </p>
              )}

              {/* Cancelled message */}
              {job.status === 'cancelled' && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('generation.cancelledDesc')}
                </p>
              )}

              {/* Progress bar */}
              {isActive && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#7c3aed]/10">
                  <div
                    className="h-full rounded-full bg-[#7c3aed] transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex items-center gap-3">
                {isActive && (
                  <Button
                    onClick={handleCancel}
                    disabled={cancelJob.isPending}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-[#ef4444] text-[#ef4444] hover:bg-red-50"
                  >
                    {cancelJob.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <XOctagon className="h-3.5 w-3.5" />
                    )}
                    {cancelJob.isPending ? t('generation.cancelling') : t('generation.cancelJob')}
                  </Button>
                )}

                {job.status === 'completed' && (
                  <Button
                    onClick={() => navigate(`/projects/${projectId}/modules`)}
                    size="sm"
                    className="gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t('generation.viewResults')}
                  </Button>
                )}

                {(job.status === 'failed' || job.status === 'cancelled') && (
                  <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" />
                    {job.status === 'cancelled' ? t('generation.startNew') : t('generation.retry')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Terminal */}
      <JobTerminal logs={logs} isActive={isActive} />
    </div>
  );
}

/* ── Terminal Component ── */
function JobTerminal({ logs, isActive }: { logs: any[]; isActive: boolean }) {
  const { t } = useTranslation();
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#1e1b4b]">
            <Terminal className="h-4 w-4" />
            {t('generation.agentLogs')}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {logs.length} {t('generation.entries')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={termRef}
          className="rounded-md bg-[#1e1b4b] p-4 h-64 overflow-y-auto font-mono text-xs leading-relaxed"
        >
          {logs.length === 0 ? (
            <p className="text-gray-500">{t('generation.waitingForOutput')}</p>
          ) : (
            logs.map((log: any, i: number) => (
              <div key={i} className="flex gap-2 py-0.5">
                <span className="text-gray-500 shrink-0">
                  [{formatTime(log.timestamp)}]
                </span>
                <span className={getLogColor(log.status)}>
                  {log.status}:
                </span>
                <span className="text-gray-300">{log.step}</span>
              </div>
            ))
          )}
          {isActive && (
            <span className="inline-block w-1.5 h-4 bg-green-400 animate-pulse mt-1" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Agent Setup Guide ── */
function AgentSetupGuide({ pendingSeconds }: { pendingSeconds: number }) {
  const { t } = useTranslation();
  const [copiedStep, setCopiedStep] = useState<number | null>(null);

  const copyToClipboard = (text: string, step: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStep(step);
      setTimeout(() => setCopiedStep(null), 2000);
    });
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
  const apiUrl = import.meta.env.VITE_API_URL || 'https://your-backend.vercel.app/api';

  const steps = [
    {
      title: t('agentSetup.step1Title'),
      desc: t('agentSetup.step1Desc'),
      command: 'cd apps/agent && pnpm install && npx tsc',
    },
    {
      title: t('agentSetup.step2Title'),
      desc: t('agentSetup.step2Desc'),
      command: `export QA_SUPABASE_URL="${supabaseUrl}"\nexport QA_SUPABASE_ANON_KEY="${supabaseKey}"\nexport QA_API_URL="${apiUrl}"\nexport QA_GEMINI_API_KEY="your-gemini-key"`,
    },
    {
      title: t('agentSetup.step3Title'),
      desc: t('agentSetup.step3Desc'),
      command: 'node dist/index.js login',
    },
    {
      title: t('agentSetup.step4Title'),
      desc: t('agentSetup.step4Desc'),
      command: 'node dist/index.js start',
    },
  ];

  return (
    <Card className="border-[#f59e0b] bg-amber-50">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <WifiOff className="h-5 w-5 text-[#f59e0b]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1e1b4b]">
              {t('agentSetup.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('agentSetup.description', { seconds: pendingSeconds })}
            </p>
          </div>
          <Badge variant="warning" className="shrink-0 ml-auto">
            {pendingSeconds}s
          </Badge>
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg border border-amber-200 bg-white p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-[#1e1b4b]">{step.title}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => copyToClipboard(step.command, i)}
                >
                  {copiedStep === i ? (
                    <Check className="h-3 w-3 text-[#10b981]" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copiedStep === i ? t('agentSetup.copied') : t('agentSetup.copy')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{step.desc}</p>
              <pre className="rounded bg-[#1e1b4b] p-2.5 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap">
                {step.command}
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-100 p-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t('agentSetup.autoDetect')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Helpers ── */
function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return '--:--:--';
  }
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-6 w-6';
  switch (status) {
    case 'pending': return <Clock className={`${cls} text-[#7c3aed] animate-pulse`} />;
    case 'crawling': return <Globe className={`${cls} text-[#8b5cf6] animate-spin`} />;
    case 'analyzing': return <Brain className={`${cls} text-[#7c3aed] animate-pulse`} />;
    case 'generating': return <Code className={`${cls} text-[#7c3aed]`} />;
    case 'completed': return <CheckCircle2 className={`${cls} text-[#10b981]`} />;
    case 'failed': return <XCircle className={`${cls} text-[#ef4444]`} />;
    case 'cancelled': return <Ban className={`${cls} text-gray-400`} />;
    default: return <Loader2 className={`${cls} text-[#7c3aed] animate-spin`} />;
  }
}

function getStatusTitle(status: string, t: any): string {
  const map: Record<string, string> = {
    pending: t('generation.pending'),
    crawling: t('generation.crawling'),
    analyzing: t('generation.analyzing'),
    generating: t('generation.generating'),
    completed: t('generation.completed'),
    failed: t('generation.failed'),
    cancelled: t('generation.cancelled'),
  };
  return map[status] || status;
}

function getStatusBorderColor(status: string): string {
  switch (status) {
    case 'completed': return 'border-[#10b981]';
    case 'failed': return 'border-[#ef4444]';
    case 'cancelled': return 'border-gray-300';
    default: return 'border-[#7c3aed]';
  }
}

function getStatusBgColor(status: string): string {
  switch (status) {
    case 'completed': return 'bg-[#10b981]/15';
    case 'failed': return 'bg-[#ef4444]/15';
    case 'cancelled': return 'bg-gray-100';
    default: return 'bg-[#7c3aed]/15';
  }
}

function getStatusBadgeVariant(status: string): any {
  switch (status) {
    case 'completed': return 'success';
    case 'failed': return 'destructive';
    case 'cancelled': return 'secondary';
    default: return 'info';
  }
}

function getLogColor(status: string): string {
  switch (status) {
    case 'crawling': return 'text-blue-400';
    case 'analyzing': return 'text-purple-400';
    case 'generating': return 'text-yellow-400';
    case 'completed': return 'text-green-400';
    case 'failed': return 'text-red-400';
    case 'cancelled': return 'text-gray-400';
    default: return 'text-gray-400';
  }
}
