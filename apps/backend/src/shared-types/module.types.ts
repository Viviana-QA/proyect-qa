export interface AppModule {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  discovered_urls: string[];
  element_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateModuleDto {
  name: string;
  description?: string;
  discovered_urls?: string[];
  element_count?: number;
}

export interface UpdateModuleDto {
  name?: string;
  description?: string;
  discovered_urls?: string[];
  element_count?: number;
}

export interface AIGenerationJob {
  id: string;
  project_id: string;
  triggered_by: string;
  status:
    | 'pending'
    | 'processing'
    | 'crawling'
    | 'analyzing'
    | 'generating'
    | 'completed'
    | 'failed';
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

export interface CreateGenerationJobDto {
  test_types?: string[];
}
