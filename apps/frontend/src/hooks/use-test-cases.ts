import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  TestCase,
  CreateTestCaseDto,
  UpdateTestCaseDto,
  TestSuite,
  CreateTestSuiteDto,
} from '@qa/shared-types';

export function useTestSuites(projectId: string) {
  return useQuery({
    queryKey: ['test-suites', projectId],
    queryFn: () =>
      api.get<TestSuite[]>(`/projects/${projectId}/test-suites`),
    enabled: !!projectId,
  });
}

export function useTestCases(projectId: string, filters?: { test_type?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.test_type) params.set('test_type', filters.test_type);
  if (filters?.status) params.set('status', filters.status);
  const query = params.toString() ? `?${params}` : '';

  return useQuery({
    queryKey: ['test-cases', projectId, filters],
    queryFn: () =>
      api.get<TestCase[]>(`/projects/${projectId}/test-cases${query}`),
    enabled: !!projectId,
  });
}

export function useTestCase(id: string) {
  return useQuery({
    queryKey: ['test-cases', 'detail', id],
    queryFn: () => api.get<TestCase>(`/test-cases/${id}`),
    enabled: !!id,
  });
}

export function useCreateTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTestSuiteDto) =>
      api.post<TestSuite>(`/projects/${projectId}/test-suites`, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] }),
  });
}

export function useCreateTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTestCaseDto) =>
      api.post<TestCase>(`/projects/${projectId}/test-cases`, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] }),
  });
}

export function useUpdateTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTestCaseDto }) =>
      api.patch<TestCase>(`/test-cases/${id}`, dto),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-cases'] }),
  });
}

export function useDeleteTestCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/test-cases/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['test-cases'] }),
  });
}

export function useDeleteTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) => api.delete(`/test-suites/${suiteId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}
