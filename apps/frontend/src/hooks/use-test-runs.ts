import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TestRun, TestResult, CreateTestRunDto } from '@qa/shared-types';

export function useTestRuns(projectId: string) {
  return useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: () =>
      api.get<TestRun[]>(`/projects/${projectId}/test-runs`),
    enabled: !!projectId,
  });
}

export function useTestRun(id: string) {
  return useQuery({
    queryKey: ['test-runs', 'detail', id],
    queryFn: () =>
      api.get<TestRun & { results: TestResult[] }>(`/test-runs/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && ['completed', 'failed', 'cancelled'].includes(data.status)) {
        return false;
      }
      return 3000;
    },
  });
}

export function useCreateTestRun(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTestRunDto) =>
      api.post<TestRun>(`/projects/${projectId}/test-runs`, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] }),
  });
}
