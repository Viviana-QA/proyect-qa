export type TestType =
  | 'e2e'
  | 'regression'
  | 'visual'
  | 'accessibility'
  | 'performance'
  | 'api'
  | 'cross_browser'
  | 'responsive';

export type TestPriority = 'low' | 'medium' | 'high' | 'critical';
export type TestCaseStatus = 'active' | 'draft' | 'disabled' | 'archived';

export interface TestSuite {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  test_type: TestType;
  is_ai_generated: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  suite_id: string;
  project_id: string;
  title: string;
  description: string | null;
  test_type: TestType;
  playwright_code: string;
  ai_prompt_used: string | null;
  tags: string[];
  priority: TestPriority;
  status: TestCaseStatus;
  browser_targets: string[];
  viewport_config: ViewportConfig | null;
  expected_screenshot_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewportConfig {
  width: number;
  height: number;
  device_name?: string;
  has_touch?: boolean;
  is_mobile?: boolean;
}

export interface CreateTestCaseDto {
  suite_id: string;
  title: string;
  description?: string;
  test_type: TestType;
  playwright_code: string;
  tags?: string[];
  priority?: TestPriority;
  browser_targets?: string[];
  viewport_config?: ViewportConfig;
}

export interface UpdateTestCaseDto {
  title?: string;
  description?: string;
  playwright_code?: string;
  tags?: string[];
  priority?: TestPriority;
  status?: TestCaseStatus;
  browser_targets?: string[];
  viewport_config?: ViewportConfig;
}

export interface CreateTestSuiteDto {
  name: string;
  description?: string;
  test_type: TestType;
}
