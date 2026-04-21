import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  AIRefineRequest,
  AIRefineResponse,
  AICompleteTestRequest,
  AICompleteTestResponse,
} from '@qa/shared-types';

export function useGenerateTests() {
  return useMutation({
    mutationFn: (request: AIGenerateRequest) =>
      api.post<AIGenerateResponse>('/ai/generate-tests', request),
  });
}

export function useRefineTest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AIRefineRequest) =>
      api.post<AIRefineResponse>('/ai/refine-test', request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      queryClient.invalidateQueries({ queryKey: ['test-case'] });
    },
  });
}

export function useCompleteTestCase() {
  return useMutation({
    mutationFn: (req: AICompleteTestRequest) =>
      api.post<AICompleteTestResponse>('/ai/complete-test-case', req),
  });
}

export function useAnalyzeUrl() {
  return useMutation({
    mutationFn: (body: { url: string; page_data: string }) =>
      api.post<string>('/ai/analyze-url', body),
  });
}
