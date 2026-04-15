import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type JobStatus = 'pending' | 'crawling' | 'analyzing' | 'generating' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  project_id: string;
  triggered_by: string;
  status: JobStatus;
  test_types: string[];
  progress_message: string | null;
  result_summary: any | null;
  error_message: string | null;
  modules_found: number;
  test_cases_generated: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export function useGenerationJob(jobId: string) {
  const queryClient = useQueryClient();

  const query = useQuery<GenerationJob>({
    queryKey: ['generation-jobs', jobId],
    queryFn: () => api.get(`/ai/generation-jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as GenerationJob | undefined;
      if (!data) return 3000;
      if (data.status === 'completed' || data.status === 'failed') return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`generation-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_generation_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          queryClient.setQueryData(['generation-jobs', jobId], payload.new);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, queryClient]);

  return query;
}

export function useLatestGenerationJob(projectId: string) {
  return useQuery<GenerationJob | null>({
    queryKey: ['generation-jobs', 'latest', projectId],
    queryFn: async () => {
      const jobs = await api.get<GenerationJob[]>(
        `/ai/generation-jobs/project/${projectId}`,
      );
      return jobs?.[0] ?? null;
    },
    enabled: !!projectId,
  });
}

export function useStartGeneration(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { test_types?: string[] }) =>
      api.post<GenerationJob>(`/ai/generate-tests`, {
        project_id: projectId,
        ...data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['generation-jobs', 'latest', projectId],
      });
    },
  });
}
