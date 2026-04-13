import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AgentConfig } from '../config/agent-config';
import type { TestRun, TestCase, SubmitTestResultDto } from '@qa/shared-types';

export class ApiClient {
  private supabase: SupabaseClient;
  private accessToken: string | null = null;

  constructor(private config: AgentConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  async login(email: string, password: string): Promise<void> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    this.accessToken = data.session.access_token;
  }

  async restoreSession(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession();
    if (data.session) {
      this.accessToken = data.session.access_token;
      return true;
    }
    return false;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.apiUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers, ...options.headers },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    if (response.status === 204) return undefined as unknown as T;
    return response.json() as Promise<T>;
  }

  async getPendingRuns(): Promise<TestRun[]> {
    return this.request(`/test-runs/pending?agent_id=${this.config.agentId}`);
  }

  async claimRun(runId: string): Promise<TestRun> {
    return this.request(`/test-runs/${runId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: this.config.agentId }),
    });
  }

  async getRunTestCases(runId: string): Promise<TestCase[]> {
    return this.request(`/test-runs/${runId}/test-cases`);
  }

  async submitResult(runId: string, result: SubmitTestResultDto): Promise<void> {
    await this.request(`/test-runs/${runId}/results`, {
      method: 'POST',
      body: JSON.stringify(result),
    });
  }

  async completeRun(runId: string, durationMs: number): Promise<void> {
    await this.request(`/test-runs/${runId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ duration_ms: durationMs }),
    });
  }

  getSupabase(): SupabaseClient {
    return this.supabase;
  }
}
