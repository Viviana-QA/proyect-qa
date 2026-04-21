import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { JiraConfig } from '@qa/shared-types';

export function useJiraConfig(projectId: string) {
  return useQuery({
    queryKey: ['jira-config', projectId],
    queryFn: () =>
      api.get<JiraConfig | null>(`/projects/${projectId}/jira-config`).catch(
        () => null,
      ),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
