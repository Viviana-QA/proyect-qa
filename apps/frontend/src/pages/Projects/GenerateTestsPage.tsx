import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Compass,
  Target,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const TEST_TYPE_VALUES = ['e2e', 'regression', 'visual', 'accessibility', 'performance', 'api'] as const;

type StreamPhase = 'idle' | 'extracting' | 'generating' | 'parsing' | 'complete' | 'error' | 'saving';
type WizardMode = 'quick' | 'guided';
type ExplorePhase = 'idle' | 'scraping' | 'analyzing' | 'complete' | 'error';

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

interface SuggestedAssertion {
  id: string;
  description: string;
  code: string;
}

interface ExploredFlow {
  id: string;
  name: string;
  description: string;
  priority: string;
  entry_url: string;
  suggested_assertions: SuggestedAssertion[];
}

interface ExploredModule {
  id: string;
  name: string;
  description: string;
  urls: string[];
  flows: ExploredFlow[];
}

interface SiteStructure {
  site_summary: string;
  detected_language: string;
  modules: ExploredModule[];
}

// A flow prepared for generation (includes user's selected + custom assertions)
interface FlowForGeneration {
  id: string;
  module_name: string;
  name: string;
  description: string;
  priority: string;
  entry_url: string;
  assertions: { description: string; code: string }[];
}

export function GenerateTestsPage() {
  const { t, i18n } = useTranslation();
  const TEST_TYPES = TEST_TYPE_VALUES.map((value) => ({
    value,
    label: t(`testTypes.${value}`),
  }));
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

  // ─── Guided mode (2-step: explore → select → generate) ─────────
  const [mode, setMode] = useState<WizardMode>('guided');
  const [explorePhase, setExplorePhase] = useState<ExplorePhase>('idle');
  const [exploreProgress, setExploreProgress] = useState<{ urls: string[]; currentMessage: string }>({
    urls: [],
    currentMessage: '',
  });
  const [siteStructure, setSiteStructure] = useState<SiteStructure | null>(null);
  const [exploreError, setExploreError] = useState('');

  // Selection state: flow IDs user wants to generate + per-flow assertion picks
  const [selectedFlows, setSelectedFlows] = useState<Set<string>>(new Set());
  const [selectedAssertions, setSelectedAssertions] = useState<Record<string, Set<string>>>({});
  const [customAssertions, setCustomAssertions] = useState<
    Record<string, { description: string; code: string }[]>
  >({});
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());

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

  /* ============== GUIDED MODE: EXPLORATION ============== */

  const handleExplore = useCallback(async () => {
    if (!project) return;

    setExplorePhase('scraping');
    setSiteStructure(null);
    setExploreError('');
    setExploreProgress({ urls: [], currentMessage: 'Iniciando...' });
    // Reset selection
    setSelectedFlows(new Set());
    setSelectedAssertions({});
    setCustomAssertions({});

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const backendBase = API_URL.trim().replace(/\/+$/, '').replace(/\/api$/, '');

      const response = await fetch(`${backendBase}/api/explore-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base_url: project.base_url,
          project_name: project.name,
          language: i18n.language,
          max_pages: 8,
          business_context: project.industry
            ? {
                industry: project.industry,
                target_audience: project.target_audience,
                key_flows: project.key_flows,
              }
            : undefined,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              const data = JSON.parse(line.substring(6));
              handleExploreEvent(currentEvent, data);
            } catch {
              // skip malformed
            }
            currentEvent = '';
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setExplorePhase('idle');
      } else {
        setExplorePhase('error');
        setExploreError(err.message);
      }
    }
  }, [project, i18n.language]);

  const handleExploreEvent = (event: string, data: any) => {
    switch (event) {
      case 'status':
        if (data.step === 'analyzing') setExplorePhase('analyzing');
        setExploreProgress((p) => ({ ...p, currentMessage: data.message || '' }));
        break;
      case 'links_found':
        setExploreProgress((p) => ({
          ...p,
          urls: data.to_visit || [],
          currentMessage: `${(data.to_visit || []).length} páginas por analizar`,
        }));
        break;
      case 'page_done':
        setExploreProgress((p) => ({
          ...p,
          currentMessage: `Página analizada: ${data.url}`,
        }));
        break;
      case 'page_failed':
        setExploreProgress((p) => ({
          ...p,
          currentMessage: `No se pudo analizar: ${data.url}`,
        }));
        break;
      case 'complete':
        setSiteStructure(data.structure || null);
        setExplorePhase('complete');
        // Auto-select all flows and all assertions as default
        if (data.structure?.modules) {
          const flowIds = new Set<string>();
          const modIds = new Set<string>();
          const assertMap: Record<string, Set<string>> = {};
          for (const mod of data.structure.modules) {
            modIds.add(mod.id);
            for (const f of mod.flows || []) {
              flowIds.add(f.id);
              assertMap[f.id] = new Set((f.suggested_assertions || []).map((a: any) => a.id));
            }
          }
          setSelectedFlows(flowIds);
          setSelectedAssertions(assertMap);
          setExpandedModules(modIds);
        }
        break;
      case 'error':
        setExplorePhase('error');
        setExploreError(data.message);
        break;
    }
  };

  const toggleFlow = (flowId: string) => {
    setSelectedFlows((prev) => {
      const next = new Set(prev);
      if (next.has(flowId)) next.delete(flowId);
      else next.add(flowId);
      return next;
    });
  };

  const toggleAssertion = (flowId: string, assertionId: string) => {
    setSelectedAssertions((prev) => {
      const current = new Set(prev[flowId] ?? []);
      if (current.has(assertionId)) current.delete(assertionId);
      else current.add(assertionId);
      return { ...prev, [flowId]: current };
    });
  };

  const addCustomAssertion = (flowId: string, description: string, code: string) => {
    if (!description.trim() || !code.trim()) return;
    setCustomAssertions((prev) => ({
      ...prev,
      [flowId]: [...(prev[flowId] || []), { description: description.trim(), code: code.trim() }],
    }));
  };

  const removeCustomAssertion = (flowId: string, idx: number) => {
    setCustomAssertions((prev) => ({
      ...prev,
      [flowId]: (prev[flowId] || []).filter((_, i) => i !== idx),
    }));
  };

  const toggleModuleExpand = (modId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(modId)) next.delete(modId);
      else next.add(modId);
      return next;
    });
  };

  const toggleFlowExpand = (flowId: string) => {
    setExpandedFlows((prev) => {
      const next = new Set(prev);
      if (next.has(flowId)) next.delete(flowId);
      else next.add(flowId);
      return next;
    });
  };

  /**
   * Build the flows payload from current selection to send to generate-stream.
   */
  const buildFlowsPayload = useCallback((): FlowForGeneration[] => {
    if (!siteStructure) return [];
    const flows: FlowForGeneration[] = [];
    for (const mod of siteStructure.modules) {
      for (const f of mod.flows || []) {
        if (!selectedFlows.has(f.id)) continue;
        const assertionIds = selectedAssertions[f.id] || new Set<string>();
        const suggested = (f.suggested_assertions || []).filter((a) => assertionIds.has(a.id));
        const custom = customAssertions[f.id] || [];
        const all = [
          ...suggested.map((a) => ({ description: a.description, code: a.code })),
          ...custom,
        ];
        if (all.length === 0) continue; // skip flows with zero assertions
        flows.push({
          id: f.id,
          module_name: mod.name,
          name: f.name,
          description: f.description,
          priority: f.priority || 'medium',
          entry_url: f.entry_url || project?.base_url || '',
          assertions: all,
        });
      }
    }
    return flows;
  }, [siteStructure, selectedFlows, selectedAssertions, customAssertions, project]);

  const selectedFlowCount = useMemo(() => buildFlowsPayload().length, [buildFlowsPayload]);

  /* ============== END GUIDED MODE ============== */

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
      // Defensive: trim whitespace/newlines (env vars can have trailing \n) and
      // strip trailing slashes + /api so we always hit exactly /api/generate-stream
      const backendBase = API_URL.trim().replace(/\/+$/, '').replace(/\/api$/, '');

      const flowsPayload = mode === 'guided' ? buildFlowsPayload() : null;

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
          // When in guided mode with selected flows, generator produces ONLY
          // those flows with their chosen assertions — no AI invention
          selected_flows: flowsPayload && flowsPayload.length > 0 ? flowsPayload : undefined,
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
  }, [project, selectedTypes, i18n.language, mode, buildFlowsPayload]);

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
      setError(t('generate.saveFailed', { message: err.message }));
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

      {/* Mode switcher + form — hidden while any stream is active */}
      {(phase === 'idle' || saved) && (
        <>
          {/* Mode switcher */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-[#1e1b4b]">¿Cómo quieres generar los tests?</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode('guided')}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    mode === 'guided'
                      ? 'border-[#7c3aed] bg-[#f5f3ff] shadow-sm'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Compass className={`h-5 w-5 ${mode === 'guided' ? 'text-[#7c3aed]' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-semibold text-[#1e1b4b]">Modo guiado (recomendado)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Explora el sitio, te muestra los módulos y flujos, tú eliges qué probar y qué asserciones usar. Tests más precisos.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    mode === 'quick'
                      ? 'border-[#7c3aed] bg-[#f5f3ff] shadow-sm'
                      : 'border-border hover:bg-muted/30'
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Zap className={`h-5 w-5 ${mode === 'quick' ? 'text-[#7c3aed]' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-semibold text-[#1e1b4b]">Modo rápido</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Análisis de una sola página. La IA decide todo. Útil para prototipar rápido.
                  </p>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* ───────── GUIDED MODE ───────── */}
          {mode === 'guided' && (
            <>
              {/* Step 1: Exploration */}
              {explorePhase === 'idle' && !siteStructure && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#1e1b4b]">
                      <Compass className="h-5 w-5 text-[#7c3aed]" />
                      Paso 1 de 2 — Explorar el sitio
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      La IA navegará hasta 8 páginas del sitio para mapear módulos y flujos. Toma ~30s.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleExplore}
                      className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
                    >
                      <Compass className="h-4 w-4" />
                      Empezar exploración
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Exploration in progress */}
              {(explorePhase === 'scraping' || explorePhase === 'analyzing') && (
                <Card className="border-l-4 border-[#7c3aed]">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-[#7c3aed]" />
                      <div>
                        <p className="text-sm font-semibold text-[#1e1b4b]">
                          {explorePhase === 'scraping' ? 'Explorando el sitio...' : 'IA analizando estructura...'}
                        </p>
                        <p className="text-xs text-muted-foreground">{exploreProgress.currentMessage}</p>
                      </div>
                    </div>
                    {exploreProgress.urls.length > 0 && (
                      <div className="mt-3 space-y-1 max-h-48 overflow-auto rounded-md bg-[#f5f3ff] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7c3aed]">
                          Páginas a analizar ({exploreProgress.urls.length})
                        </p>
                        {exploreProgress.urls.map((u) => (
                          <p key={u} className="truncate font-mono text-[11px] text-muted-foreground">
                            • {u}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Exploration error */}
              {explorePhase === 'error' && (
                <Card className="border-[#ef4444] bg-red-50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-[#ef4444]">Exploración falló</p>
                    <p className="mt-1 text-xs text-red-700">{exploreError}</p>
                    <Button
                      onClick={handleExplore}
                      size="sm"
                      variant="outline"
                      className="mt-3 border-[#ef4444] text-[#ef4444] hover:bg-red-100"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" /> Reintentar
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Step 2: Selection (site structure loaded) */}
              {explorePhase === 'complete' && siteStructure && (
                <>
                  <Card className="border-l-4 border-[#10b981]">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="mb-1 text-sm font-semibold text-[#1e1b4b]">
                            ✓ Exploración completa — {siteStructure.modules.length} módulos, {' '}
                            {siteStructure.modules.reduce((s, m) => s + (m.flows?.length || 0), 0)} flujos detectados
                          </p>
                          <p className="text-xs text-muted-foreground">{siteStructure.site_summary}</p>
                        </div>
                        <Button
                          onClick={handleExplore}
                          size="sm"
                          variant="outline"
                          className="gap-1 border-[#7c3aed]/30 text-[#7c3aed] hover:bg-[#f5f3ff]"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Explorar de nuevo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold text-[#1e1b4b]">
                        <Target className="h-5 w-5 text-[#7c3aed]" />
                        Paso 2 de 2 — Seleccionar flujos y asserciones
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Marca qué flujos quieres probar. Para cada uno, revisa las asserciones sugeridas o agrega las tuyas.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {siteStructure.modules.map((mod) => (
                        <ModuleSelector
                          key={mod.id}
                          module={mod}
                          selectedFlows={selectedFlows}
                          selectedAssertions={selectedAssertions}
                          customAssertions={customAssertions}
                          expanded={expandedModules.has(mod.id)}
                          expandedFlows={expandedFlows}
                          onToggleFlow={toggleFlow}
                          onToggleAssertion={toggleAssertion}
                          onAddCustom={addCustomAssertion}
                          onRemoveCustom={removeCustomAssertion}
                          onToggleExpand={() => toggleModuleExpand(mod.id)}
                          onToggleFlowExpand={toggleFlowExpand}
                        />
                      ))}

                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#f5f3ff] p-4">
                        <div>
                          <p className="text-sm font-semibold text-[#1e1b4b]">
                            {selectedFlowCount} flujo{selectedFlowCount !== 1 ? 's' : ''} listo{selectedFlowCount !== 1 ? 's' : ''} para generar
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Cada flujo produce un test case con sus asserciones seleccionadas.
                          </p>
                        </div>
                        <Button
                          onClick={handleGenerate}
                          disabled={selectedFlowCount === 0}
                          size="lg"
                          className="gap-2 bg-[#7c3aed] hover:bg-[#6d28d9]"
                        >
                          <Zap className="h-4 w-4" />
                          Generar {selectedFlowCount} test{selectedFlowCount !== 1 ? 's' : ''}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </>
          )}

          {/* ───────── QUICK MODE ───────── */}
          {mode === 'quick' && (
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
        </>
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
                    {phase === 'extracting' && t('generate.extracting')}
                    {phase === 'generating' && t('generate.writingTests')}
                    {phase === 'parsing' && t('generate.parsingTests')}
                    {phase === 'complete' && t('generate.doneModules', { modules: modules.length, testCases: modules.reduce((s, m) => s + (m.test_cases?.length || 0), 0) })}
                    {phase === 'error' && t('generate.generationFailed')}
                  </p>
                  {phase === 'generating' && (
                    <p className="text-xs text-muted-foreground">
                      {t('generate.charsGenerated', { count: streamText.length.toLocaleString() })}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {(phase === 'extracting' || phase === 'generating') && (
                  <Button variant="outline" size="sm" onClick={handleCancel}
                    className="gap-1 border-[#ef4444] text-[#ef4444] hover:bg-red-50">
                    <XCircle className="h-3.5 w-3.5" />
                    {t('generate.cancel')}
                  </Button>
                )}
                {phase === 'complete' && !saved && (
                  <>
                    <Button size="sm" onClick={handleSave} disabled={saving}
                      className="gap-1 bg-[#10b981] hover:bg-[#059669]">
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      {saving ? t('generate.saving') : t('generate.saveToProject')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setPhase('idle'); setStreamText(''); }}
                      className="gap-1">
                      <RotateCcw className="h-3.5 w-3.5" /> {t('generate.retry')}
                    </Button>
                  </>
                )}
                {phase === 'error' && (
                  <Button variant="outline" size="sm" onClick={() => setPhase('idle')} className="gap-1">
                    <RotateCcw className="h-3.5 w-3.5" /> {t('generate.retry')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Display */}
          {phase === 'error' && error && (
            <Card className="border-[#ef4444] bg-red-50">
              <CardContent className="p-4 text-sm text-[#ef4444]">
                <strong>{t('generate.error')}:</strong> {error}
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
                    {t('generate.aiOutputStream')}
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-mono">
                    {streamText.length.toLocaleString()} {t('generate.chars')}
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
                  {t('generate.generatedModules', { count: modules.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {modules.map((mod, i) => (
                  <div key={i} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-[#1e1b4b]">{mod.name}</h4>
                      <Badge variant="info">{mod.test_cases?.length || 0} {t('generate.tests')}</Badge>
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
                    {t('generate.savedSuccess')}
                  </span>
                </div>
                <Button size="sm" onClick={() => navigate(`/projects/${id}/modules`)}
                  className="gap-1 bg-[#7c3aed] hover:bg-[#6d28d9]">
                  <Eye className="h-3.5 w-3.5" /> {t('generate.viewModules')}
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

/* ------------------------------------------------------------------ */
/*  ModuleSelector — tree row for guided mode's selection UI          */
/* ------------------------------------------------------------------ */

interface ModuleSelectorProps {
  module: ExploredModule;
  selectedFlows: Set<string>;
  selectedAssertions: Record<string, Set<string>>;
  customAssertions: Record<string, { description: string; code: string }[]>;
  expanded: boolean;
  expandedFlows: Set<string>;
  onToggleFlow: (flowId: string) => void;
  onToggleAssertion: (flowId: string, assertionId: string) => void;
  onAddCustom: (flowId: string, description: string, code: string) => void;
  onRemoveCustom: (flowId: string, idx: number) => void;
  onToggleExpand: () => void;
  onToggleFlowExpand: (flowId: string) => void;
}

function ModuleSelector({
  module,
  selectedFlows,
  selectedAssertions,
  customAssertions,
  expanded,
  expandedFlows,
  onToggleFlow,
  onToggleAssertion,
  onAddCustom,
  onRemoveCustom,
  onToggleExpand,
  onToggleFlowExpand,
}: ModuleSelectorProps) {
  const flows = module.flows || [];
  const selectedCount = flows.filter((f) => selectedFlows.has(f.id)).length;

  return (
    <div className="rounded-lg border border-[#7c3aed]/20 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between bg-[#f5f3ff] px-4 py-3 text-left hover:bg-[#ede9fe]"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-[#7c3aed]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[#7c3aed]" />
          )}
          <div>
            <p className="text-sm font-semibold text-[#1e1b4b]">{module.name}</p>
            <p className="text-xs text-muted-foreground">{module.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info">{flows.length} flujos</Badge>
          <Badge variant={selectedCount > 0 ? 'success' : 'secondary'}>
            {selectedCount} seleccionados
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="divide-y">
          {flows.map((flow) => {
            const isSelected = selectedFlows.has(flow.id);
            const isFlowExpanded = expandedFlows.has(flow.id);
            const assertIds = selectedAssertions[flow.id] || new Set<string>();
            const customs = customAssertions[flow.id] || [];
            const totalAssertCount = assertIds.size + customs.length;
            return (
              <div key={flow.id} className="bg-white">
                <div className="flex items-start gap-3 px-4 py-3 hover:bg-[#f5f3ff]/30">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleFlow(flow.id)}
                    className="mt-0.5 border-[#7c3aed] data-[state=checked]:bg-[#7c3aed]"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleFlowExpand(flow.id)}
                    className="flex flex-1 items-start gap-2 text-left"
                  >
                    {isFlowExpanded ? (
                      <ChevronDown className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#1e1b4b]">{flow.name}</p>
                      <p className="text-xs text-muted-foreground">{flow.description}</p>
                    </div>
                  </button>
                  <Badge variant={flow.priority === 'high' ? 'warning' : 'secondary'} className="text-[10px]">
                    {flow.priority}
                  </Badge>
                  {isSelected && (
                    <Badge variant="success" className="text-[10px]">
                      {totalAssertCount} ✓
                    </Badge>
                  )}
                </div>

                {isFlowExpanded && (
                  <div className="space-y-3 border-l-2 border-[#7c3aed]/20 bg-[#f5f3ff]/20 px-4 py-3 ml-8">
                    {/* Suggested assertions */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#7c3aed]">
                        Asserciones sugeridas por IA
                      </p>
                      <div className="space-y-1.5">
                        {(flow.suggested_assertions || []).map((a) => {
                          const checked = assertIds.has(a.id);
                          return (
                            <label
                              key={a.id}
                              className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-2 hover:bg-[#f5f3ff]/50"
                            >
                              <Checkbox
                                checked={checked && isSelected}
                                disabled={!isSelected}
                                onCheckedChange={() => onToggleAssertion(flow.id, a.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[#1e1b4b]">{a.description}</p>
                                <code className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                                  {a.code}
                                </code>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom assertions */}
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#10b981]">
                        Asserciones personalizadas ({customs.length})
                      </p>
                      {customs.length > 0 && (
                        <div className="mb-2 space-y-1.5">
                          {customs.map((c, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-2 rounded-md border border-[#10b981]/30 bg-green-50/40 p-2"
                            >
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#10b981]" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[#1e1b4b]">{c.description}</p>
                                <code className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                                  {c.code}
                                </code>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRemoveCustom(flow.id, idx)}
                                className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {isSelected && (
                        <CustomAssertionForm
                          onAdd={(desc, code) => onAddCustom(flow.id, desc, code)}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomAssertionForm({ onAdd }: { onAdd: (desc: string, code: string) => void }) {
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="space-y-2 rounded-md border border-[#10b981]/30 bg-white p-3">
      <input
        type="text"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descripción (ej: El menú principal es visible)"
        className="w-full rounded border border-input px-2 py-1 text-xs focus:ring-1 focus:ring-[#7c3aed]/30"
      />
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="await expect(page.locator('nav')).toBeVisible();"
        rows={2}
        className="w-full rounded border border-input px-2 py-1 font-mono text-[11px] focus:ring-1 focus:ring-[#7c3aed]/30"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (desc.trim() && code.trim()) {
              onAdd(desc, code);
              setDesc('');
              setCode('');
              setOpen(false);
            }
          }}
          className="gap-1 bg-[#10b981] hover:bg-[#059669] text-[11px]"
        >
          <Plus className="h-3 w-3" /> Agregar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setDesc('');
            setCode('');
          }}
          className="text-[11px]"
        >
          Cancelar
        </Button>
      </div>
    </div>
  ) : (
    <Button
      size="sm"
      variant="outline"
      onClick={() => setOpen(true)}
      className="gap-1 border-[#10b981]/30 text-[#10b981] hover:bg-green-50 text-[11px]"
    >
      <Plus className="h-3 w-3" /> Agregar assertion personalizada
    </Button>
  );
}
