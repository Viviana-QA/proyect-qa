import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Report } from '@qa/shared-types';

export function useReports(projectId: string) {
  return useQuery({
    queryKey: ['reports', projectId],
    queryFn: () =>
      api.get<Report[]>(`/projects/${projectId}/reports`),
    enabled: !!projectId,
  });
}

export function useReport(id: string) {
  return useQuery({
    queryKey: ['reports', 'detail', id],
    queryFn: () => api.get<Report>(`/reports/${id}`),
    enabled: !!id,
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api.post<Report>(`/test-runs/${runId}/report`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}
