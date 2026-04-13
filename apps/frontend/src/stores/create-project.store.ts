import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WizardState {
  currentStep: number;

  // Step 1: Project Info
  name: string;
  base_url: string;
  project_type: string;
  environment: string;
  description: string;

  // Step 2: Auth
  requires_auth: boolean;
  login_url: string;
  auth_type: string;
  auth_username: string;
  auth_password: string;

  // Step 3: Jira
  connect_jira: boolean;
  jira_base_url: string;
  jira_email: string;
  jira_api_token: string;
  jira_connected: boolean;
  jira_project_key: string;
  jira_issue_type: string;
  auto_create_on_failure: boolean;

  // Step 4: Business Context
  industry: string;
  target_audience: string;
  key_flows: string;
  compliance: string[];
  languages: string;

  // Step 5: Test Config
  test_e2e: boolean;
  test_regression: boolean;
  test_visual: boolean;
  test_accessibility: boolean;
  test_performance: boolean;
  test_api: boolean;
  test_cross_browser: boolean;
  test_responsive: boolean;
  browsers: string[];
  devices: string[];

  // Actions
  setStep: (step: number) => void;
  updateField: (field: string, value: unknown) => void;
  toggleCompliance: (item: string) => void;
  toggleBrowser: (browser: string) => void;
  toggleDevice: (device: string) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 0,

  name: '',
  base_url: '',
  project_type: '',
  environment: 'staging',
  description: '',

  requires_auth: false,
  login_url: '',
  auth_type: '',
  auth_username: '',
  auth_password: '',

  connect_jira: false,
  jira_base_url: '',
  jira_email: '',
  jira_api_token: '',
  jira_connected: false,
  jira_project_key: '',
  jira_issue_type: 'Bug',
  auto_create_on_failure: false,

  industry: '',
  target_audience: '',
  key_flows: '',
  compliance: [] as string[],
  languages: '',

  test_e2e: true,
  test_regression: true,
  test_visual: true,
  test_accessibility: true,
  test_performance: true,
  test_api: true,
  test_cross_browser: true,
  test_responsive: true,
  browsers: ['chromium'] as string[],
  devices: ['desktop'] as string[],
};

export const useCreateProjectStore = create<WizardState>()(
  persist(
    (set) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),

      updateField: (field, value) => set({ [field]: value }),

      toggleCompliance: (item) =>
        set((state) => ({
          compliance: state.compliance.includes(item)
            ? state.compliance.filter((c) => c !== item)
            : [...state.compliance, item],
        })),

      toggleBrowser: (browser) =>
        set((state) => ({
          browsers: state.browsers.includes(browser)
            ? state.browsers.filter((b) => b !== browser)
            : [...state.browsers, browser],
        })),

      toggleDevice: (device) =>
        set((state) => ({
          devices: state.devices.includes(device)
            ? state.devices.filter((d) => d !== device)
            : [...state.devices, device],
        })),

      reset: () => set(initialState),
    }),
    {
      name: 'create-project-draft',
    },
  ),
);
