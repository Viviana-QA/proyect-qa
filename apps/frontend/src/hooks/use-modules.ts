import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AppModule {
  id: string;
  project_id: string;
  generation_job_id: string;
  name: string;
  description: string;
  discovered_urls: string[];
  elements_count: number;
  created_at: string;
  updated_at: string;
  test_suite?: {
    id: string;
    name: string;
    test_cases: TestCaseSummary[];
  };
}

export interface TestCaseSummary {
  id: string;
  title: string;
  description: string;
  test_type: string;
  priority: string;
  status: string;
  playwright_code: string;
}

export function useModules(projectId: string) {
  return useQuery<AppModule[]>({
    queryKey: ['modules', projectId],
    queryFn: () => api.get(`/projects/${projectId}/modules`),
    enabled: !!projectId,
  });
}

export function useModule(id: string) {
  return useQuery<AppModule>({
    queryKey: ['modules', 'detail', id],
    queryFn: () => api.get(`/modules/${id}`),
    enabled: !!id,
  });
}

export function useUpdateTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: { playwright_code: string } }) =>
      api.patch(`/test-cases/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modules'] });
    },
  });
}
