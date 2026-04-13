export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  base_url: string;
  environment: 'development' | 'staging' | 'production';
  auth_config: ProjectAuthConfig | null;
  project_type?: 'web_app' | 'ecommerce' | 'saas' | 'landing_page' | 'mobile_web' | 'api' | 'custom';
  industry?: string;
  target_audience?: string;
  key_flows?: string;
  compliance?: string[];
  languages?: string[];
  test_config?: ProjectTestConfig;
  draft_status?: 'draft' | 'complete';
  created_at: string;
  updated_at: string;
}

export interface ProjectAuthConfig {
  type: 'none' | 'basic' | 'bearer' | 'cookie' | 'custom';
  username?: string;
  password?: string;
  token?: string;
  login_url?: string;
  login_steps?: LoginStep[];
}

export interface LoginStep {
  action: 'navigate' | 'fill' | 'click' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
}

export interface ProjectTestConfig {
  e2e: boolean;
  regression: boolean;
  visual_regression: boolean;
  accessibility: boolean;
  performance: boolean;
  api_testing: boolean;
  cross_browser: boolean;
  responsive: boolean;
  browsers?: string[];
  devices?: string[];
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  base_url: string;
  environment?: 'development' | 'staging' | 'production';
  auth_config?: ProjectAuthConfig;
  project_type?: 'web_app' | 'ecommerce' | 'saas' | 'landing_page' | 'mobile_web' | 'api' | 'custom';
  industry?: string;
  target_audience?: string;
  key_flows?: string;
  compliance?: string[];
  languages?: string[];
  test_config?: ProjectTestConfig;
  draft_status?: 'draft' | 'complete';
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  base_url?: string;
  environment?: 'development' | 'staging' | 'production';
  auth_config?: ProjectAuthConfig;
  project_type?: 'web_app' | 'ecommerce' | 'saas' | 'landing_page' | 'mobile_web' | 'api' | 'custom';
  industry?: string;
  target_audience?: string;
  key_flows?: string;
  compliance?: string[];
  languages?: string[];
  test_config?: ProjectTestConfig;
  draft_status?: 'draft' | 'complete';
}
