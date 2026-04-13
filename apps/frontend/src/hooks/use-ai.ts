import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  AIRefineRequest,
  AIRefineResponse,
} from '@qa/shared-types';

export function useGenerateTests() {
  return useMutation({
    mutationFn: (request: AIGenerateRequest) =>
      api.post<AIGenerateResponse>('/ai/generate-tests', request),
  });
}

export function useRefineTest() {
  return useMutation({
    mutationFn: (request: AIRefineRequest) =>
      api.post<AIRefineResponse>('/ai/refine-test', request),
  });
}

export function useAnalyzeUrl() {
  return useMutation({
    mutationFn: (body: { url: string; page_data: string }) =>
      api.post<string>('/ai/analyze-url', body),
  });
}
