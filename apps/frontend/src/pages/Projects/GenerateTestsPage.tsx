import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProject } from '@/hooks/use-projects';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  Globe,
  Code,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Sparkles,
  Loader2,
  Terminal,
  Eye,
  Save,
  RotateCcw,
  Zap,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TEST_TYPES = [
  { value: 'e2e', label: 'E2E Testing' },
  { value: 'regression', label: 'Regression Testing' },
  { value: 'visual', label: 'Visual Regression' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'performance', label: 'Performance' },
  { value: 'api', label: 'API Testing' },
];

type StreamPhase = 'idle' | 'extracting' | 'generating' | 'parsing' | 'complete' | 'error' | 'saving';

interface GeneratedModule {
  name: string;
  description: string;
  test_cases: {
    title: string;
    description: string;
    test_type: string;
    priority: string;
    tags: string[];
    code: string;
  }[];
}

export function GenerateTestsPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id!);

  const [selectedTypes, setSelectedTypes] = useState<string[]>(['e2e', 'regression']);
  const [phase, setPhase] = useState<StreamPhase>('idle');
  const [streamText, setStreamText] = useState('');
  const [modules, setModules] = useState<GeneratedModule[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-scroll the stream output
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamText]);

  const toggleType = (v: string) => {
    setSelectedTypes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!project) return;

    setPhase('extracting');
    setStreamText('');
    setModules([]);
    setError('');
    setSaved(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      // Remove /api suffix for the streaming endpoint since it's at the same level
      const backendBase = API_URL.replace(/\/api\/?$/, '');

      const response = await fetch(`${backendBase}/api/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          base_url: project.base_url,
          test_types: selectedTypes,
          project_name: project.name,
          language: i18n.language,
          business_context: project.industry ? {
            industry: project.industry,
            target_audience: project.target_audience,
            key_flows: project.key_flows,
          } : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || err.detail || `HTTP ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.substring(6));
              handleSSEEvent(currentEvent, data);
            } catch {
              // skip malformed
            }
            currentEvent = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setPhase('idle');
        setStreamText('');
      } else {
        setPhase('error');
        setError(err.message);
      }
    }
  }, [project, selectedTypes, i18n.language]);

  const handleSSEEvent = (event: string, data: any) => {
    switch (event) {
      case 'status':
        if (data.step === 'generating') setPhase('generating');
        else if (data.step === 'parsing') setPhase('parsing');
        else if (data.step === 'extracting') setPhase('extracting');
        break;
      case 'chunk':
        setStreamText((prev) => prev + data.text);
        setPhase('generating');
        break;
      case 'complete':
        setModules(data.modules || []);
        setPhase('complete');
        break;
      case 'error':
        setPhase('error');
        setError(data.message);
        break;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setPhase('idle');
  };

  const handleSave = async () => {
    if (!project || modules.length === 0) return;
    setSaving(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;

      for (const mod of modules) {
        // Create module
        const modRes = await fetch(`${API_URL}/projects/${project.id}/modules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ name: mod.name, description: mod.description }),
        });
        const savedModule = await modRes.json();

        // Create test suite for module
        const suiteRes = await fetch(`${API_URL}/projects/${project.id}/test-suites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            name: `${mod.name} Tests`,
            description: mod.description,
            test_type: 'e2e',
          }),
        });
        const suite = await suiteRes.json();

        // Create test cases
        for (const tc of mod.test_cases || []) {
          await fetch(`${API_URL}/projects/${project.id}/test-cases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              suite_id: suite.id,
              title: tc.title,
              description: tc.description,
              test_type: tc.test_type || 'e2e',
              playwright_code: tc.code,
              tags: tc.tags || [],
              priority: tc.priority || 'medium',
            }),
          });
        }
      }

      setSaved(true);
    } catch (err: any) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  if (!project) return <p className="text-destructive">{t('projects.projectNotFound')}</p>;

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

      {/* Generation Form (shown when idle or after completion) */}
      {(phase === 'idle' || saved) && (
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
                      onCheckedChange={() => toggleType(type.value)}
                    />
                    <span className="text-sm font-medium text-[#1e1b4b]">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={selectedTypes.length === 0}
              className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
            >
              <Zap className="h-4 w-4" />
              {t('generation.startGeneration')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Live Streaming View */}
      {phase !== 'idle' && !saved && (
        <div className="space-y-4">
          {/* Status Bar */}
          <Card className={`border-l-4 ${
            phase === 'complete' ? 'border-[#10b981]' :
            phase === 'error' ? 'border-[#ef4444]' : 'border-[#7c3aed]'
          }`}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <PhaseIcon phase={phase} />
                <div>
                  <p className="text-sm font-medium text-[#1e1b4b]">
                    {phase === 'extracting' && 'Extracting web content...'}
                    {phase === 'generating' && 'AI is writing tests in real-time...'}
                    {phase === 'parsing' && 'Parsing generated tests...'}
                    {phase === 'complete' && `Done! ${modules.length} modules, ${modules.reduce((s, m) => s + (m.test_cases?.length || 0), 0)} test cases`}
                    {phase === 'error' && 'Generation failed'}
                  </p>
                  {phase === 'generating' && (
                    <p className="text-xs text-muted-foreground">
                      {streamText.length.toLocaleString()} characters generated
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {(phase === 'extracting' || phase === 'generating') && (
                  <Button variant="outline" size="sm" onClick={handleCancel}
                    className="gap-1 border-[#ef4444] text-[#ef4444] hover:bg-red-50">
                    <XCircle className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                )}
                {phase === 'complete' && !saved && (
                  <>
                    <Button size="sm" onClick={handleSave} disabled={saving}
                      className="gap-1 bg-[#10b981] hover:bg-[#059669]">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {saving ? 'Saving...' : 'Save to Project'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setPhase('idle'); setStreamText(''); }}
                      className="gap-1">
                      <RotateCcw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  </>
                )}
                {phase === 'error' && (
                  <Button variant="outline" size="sm" onClick={() => setPhase('idle')} className="gap-1">
                    <RotateCcw className="h-3.5 w-3.5" /> Retry
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {phase === 'error' && error && (
            <Card className="border-[#ef4444] bg-red-50">
              <CardContent className="p-4 text-sm text-[#ef4444]">
                <strong>Error:</strong> {error}
              </CardContent>
            </Card>
          )}

          {/* Live Stream Terminal (typewriter effect) */}
          {streamText && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-[#1e1b4b]">
                    <Terminal className="h-4 w-4" />
                    AI Output — Live Stream
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {streamText.length.toLocaleString()} chars
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  ref={streamRef}
                  className="rounded-md bg-[#1e1b4b] p-4 h-96 overflow-y-auto font-mono text-xs leading-relaxed"
                >
                  <pre className="text-green-400 whitespace-pre-wrap break-words">
                    {streamText}
                    {phase === 'generating' && (
                      <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0.5" />
                    )}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parsed Modules Preview (shown on complete) */}
          {phase === 'complete' && modules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold text-[#1e1b4b]">
                  Generated Modules ({modules.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {modules.map((mod, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-[#1e1b4b]">{mod.name}</h4>
                      <Badge variant="info">{mod.test_cases?.length || 0} tests</Badge>
                    </div>
                    {mod.description && (
                      <p className="text-xs text-muted-foreground mb-3">{mod.description}</p>
                    )}
                    <div className="space-y-1.5">
                      {(mod.test_cases || []).map((tc, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-[#10b981] shrink-0" />
                          <span className="text-[#1e1b4b]">{tc.title}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{tc.test_type}</Badge>
                          <Badge variant={tc.priority === 'high' ? 'destructive' : tc.priority === 'critical' ? 'destructive' : 'secondary'}
                            className="text-[10px] px-1.5 py-0">{tc.priority}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Success: Saved */}
          {saved && (
            <Card className="border-[#10b981] bg-green-50">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#10b981]" />
                  <span className="text-sm font-medium text-[#10b981]">
                    Tests saved successfully! View them in your project.
                  </span>
                </div>
                <Button size="sm" onClick={() => navigate(`/projects/${id}/modules`)}
                  className="gap-1 bg-[#7c3aed] hover:bg-[#6d28d9]">
                  <Eye className="h-3.5 w-3.5" /> View Modules
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function PhaseIcon({ phase }: { phase: StreamPhase }) {
  const cls = 'h-5 w-5';
  switch (phase) {
    case 'extracting': return <Globe className={`${cls} text-[#8b5cf6] animate-pulse`} />;
    case 'generating': return <Brain className={`${cls} text-[#7c3aed] animate-pulse`} />;
    case 'parsing': return <Code className={`${cls} text-[#7c3aed] animate-spin`} />;
    case 'complete': return <CheckCircle2 className={`${cls} text-[#10b981]`} />;
    case 'error': return <XCircle className={`${cls} text-[#ef4444]`} />;
    default: return <Loader2 className={`${cls} text-[#7c3aed] animate-spin`} />;
  }
}
