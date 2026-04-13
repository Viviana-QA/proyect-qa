import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useCreateProjectStore } from '@/stores/create-project.store';
import { useCreateProject } from '@/hooks/use-projects';
import { api } from '@/lib/api';
import { Stepper } from '@/components/ui/stepper';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  RefreshCcw,
  Image,
  Accessibility,
  Gauge,
  Globe,
  Monitor,
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Shared select component (styled to match Input)
// ---------------------------------------------------------------------------
function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Section header helper
// ---------------------------------------------------------------------------
function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-primary">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field wrapper
// ---------------------------------------------------------------------------
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ===========================================================================
// Step 1 - Project Info
// ===========================================================================
function StepProjectInfo() {
  const store = useCreateProjectStore();

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Project Information"
        description="Provide the basic details about the web application you want to test."
      />

      <Field label="Project Name" required>
        <Input
          placeholder="My Web App"
          value={store.name}
          onChange={(e) => store.updateField('name', e.target.value)}
        />
      </Field>

      <Field
        label="Base URL"
        required
        hint="The root URL of the application you want to test"
      >
        <Input
          type="url"
          placeholder="https://myapp.com"
          value={store.base_url}
          onChange={(e) => store.updateField('base_url', e.target.value)}
        />
      </Field>

      <Field label="Project Type">
        <Select
          value={store.project_type}
          onChange={(v) => store.updateField('project_type', v)}
        >
          <option value="">Select a type...</option>
          <option value="web_app">Web App</option>
          <option value="ecommerce">E-commerce</option>
          <option value="saas">SaaS</option>
          <option value="landing_page">Landing Page</option>
          <option value="mobile_web">Mobile Web</option>
          <option value="api">API</option>
          <option value="custom">Custom</option>
        </Select>
      </Field>

      <Field label="Environment">
        <Select
          value={store.environment}
          onChange={(v) => store.updateField('environment', v)}
        >
          <option value="development">Development</option>
          <option value="staging">Staging</option>
          <option value="production">Production</option>
        </Select>
      </Field>

      <Field label="Description" hint="A brief description of your application">
        <Textarea
          placeholder="Brief description of your application"
          value={store.description}
          onChange={(e) => store.updateField('description', e.target.value)}
        />
      </Field>
    </div>
  );
}

// ===========================================================================
// Step 2 - Authentication
// ===========================================================================
function StepAuthentication() {
  const store = useCreateProjectStore();

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Authentication"
        description="Configure login credentials if your application requires authentication to test."
      />

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Does this app require login?</p>
          <p className="text-xs text-muted-foreground">
            Enable if testers need to authenticate before accessing the app
          </p>
        </div>
        <Switch
          checked={store.requires_auth}
          onCheckedChange={(v) => store.updateField('requires_auth', v)}
        />
      </div>

      {store.requires_auth && (
        <div className="space-y-5 rounded-lg border border-dashed p-4">
          <Field label="Login URL" hint="The URL of the login page">
            <Input
              type="url"
              placeholder="https://myapp.com/login"
              value={store.login_url}
              onChange={(e) => store.updateField('login_url', e.target.value)}
            />
          </Field>

          <Field label="Authentication Type">
            <Select
              value={store.auth_type}
              onChange={(v) => store.updateField('auth_type', v)}
            >
              <option value="">Select type...</option>
              <option value="email_password">Email / Password</option>
              <option value="oauth">OAuth</option>
              <option value="bearer">Bearer Token</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>

          <Field label="Username / Email">
            <Input
              placeholder="test@example.com"
              value={store.auth_username}
              onChange={(e) =>
                store.updateField('auth_username', e.target.value)
              }
            />
          </Field>

          <Field label="Password">
            <Input
              type="password"
              placeholder="Enter password"
              value={store.auth_password}
              onChange={(e) =>
                store.updateField('auth_password', e.target.value)
              }
            />
          </Field>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Step 3 - Jira Integration
// ===========================================================================
function StepJira() {
  const store = useCreateProjectStore();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [testError, setTestError] = useState('');
  const [projects, setProjects] = useState<{ key: string; name: string }[]>([]);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    setTestError('');
    try {
      await api.post('/jira/test-connection', {
        base_url: store.jira_base_url,
        email: store.jira_email,
        api_token: store.jira_api_token,
      });

      // Fetch available projects
      const result = await api.post<{ key: string; name: string }[]>(
        '/jira/projects',
        {
          base_url: store.jira_base_url,
          email: store.jira_email,
          api_token: store.jira_api_token,
        },
      );
      setProjects(result);
      setTestResult('success');
      store.updateField('jira_connected', true);
    } catch (err: unknown) {
      setTestResult('error');
      setTestError(
        err instanceof Error ? err.message : 'Connection failed',
      );
      store.updateField('jira_connected', false);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Jira Integration"
        description="Optionally connect to Jira to automatically create issues for failed tests."
      />

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">Connect to Jira?</p>
          <p className="text-xs text-muted-foreground">
            Link your Jira workspace for automatic bug tracking
          </p>
        </div>
        <Switch
          checked={store.connect_jira}
          onCheckedChange={(v) => store.updateField('connect_jira', v)}
        />
      </div>

      {store.connect_jira && (
        <div className="space-y-5 rounded-lg border border-dashed p-4">
          <Field label="Jira Base URL">
            <Input
              placeholder="https://yourorg.atlassian.net"
              value={store.jira_base_url}
              onChange={(e) =>
                store.updateField('jira_base_url', e.target.value)
              }
            />
          </Field>

          <Field label="Jira Email">
            <Input
              type="email"
              placeholder="you@company.com"
              value={store.jira_email}
              onChange={(e) =>
                store.updateField('jira_email', e.target.value)
              }
            />
          </Field>

          <Field
            label="API Token"
            hint="Generate at id.atlassian.com/manage-profile/security/api-tokens"
          >
            <Input
              type="password"
              placeholder="Enter Jira API token"
              value={store.jira_api_token}
              onChange={(e) =>
                store.updateField('jira_api_token', e.target.value)
              }
            />
          </Field>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleTestConnection}
              disabled={
                testing ||
                !store.jira_base_url ||
                !store.jira_email ||
                !store.jira_api_token
              }
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>

            {testResult === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Connected successfully
              </span>
            )}
            {testResult === 'error' && (
              <span className="flex items-center gap-1 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {testError}
              </span>
            )}
          </div>

          {store.jira_connected && projects.length > 0 && (
            <>
              <Field label="Jira Project">
                <Select
                  value={store.jira_project_key}
                  onChange={(v) =>
                    store.updateField('jira_project_key', v)
                  }
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Issue Type">
                <Select
                  value={store.jira_issue_type}
                  onChange={(v) =>
                    store.updateField('jira_issue_type', v)
                  }
                >
                  <option value="Bug">Bug</option>
                  <option value="Task">Task</option>
                  <option value="Story">Story</option>
                </Select>
              </Field>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">
                    Auto-create issues on failure
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Automatically create Jira issues when tests fail
                  </p>
                </div>
                <Switch
                  checked={store.auto_create_on_failure}
                  onCheckedChange={(v) =>
                    store.updateField('auto_create_on_failure', v)
                  }
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Step 4 - Business Context
// ===========================================================================
function StepBusinessContext() {
  const store = useCreateProjectStore();

  const complianceOptions = [
    'WCAG AA',
    'WCAG AAA',
    'GDPR',
    'HIPAA',
    'PCI-DSS',
    'SOC 2',
  ];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Business Context"
        description="Help our AI understand your application better to generate more relevant test cases."
      />

      <Field label="Industry">
        <Select
          value={store.industry}
          onChange={(v) => store.updateField('industry', v)}
        >
          <option value="">Select an industry...</option>
          <option value="ecommerce">E-commerce</option>
          <option value="healthcare">Healthcare</option>
          <option value="finance">Finance</option>
          <option value="education">Education</option>
          <option value="social_media">Social Media</option>
          <option value="enterprise_saas">Enterprise SaaS</option>
          <option value="government">Government</option>
          <option value="media">Media</option>
          <option value="travel">Travel</option>
          <option value="other">Other</option>
        </Select>
      </Field>

      <Field
        label="Target Audience"
        hint="Describe who uses your application"
      >
        <Textarea
          placeholder="Describe your target users..."
          value={store.target_audience}
          onChange={(e) =>
            store.updateField('target_audience', e.target.value)
          }
        />
      </Field>

      <Field
        label="Key Business Flows"
        hint="List the critical user journeys to test"
      >
        <Textarea
          placeholder="Key business flows to test, e.g.: checkout process, user registration, payment flow"
          value={store.key_flows}
          onChange={(e) => store.updateField('key_flows', e.target.value)}
        />
      </Field>

      <Field label="Compliance Requirements">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {complianceOptions.map((item) => (
            <label
              key={item}
              className="flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm hover:bg-muted/50"
            >
              <Checkbox
                checked={store.compliance.includes(item)}
                onCheckedChange={() => store.toggleCompliance(item)}
              />
              {item}
            </label>
          ))}
        </div>
      </Field>

      <Field
        label="Languages"
        hint="Comma-separated language codes to test (e.g. en, es, fr)"
      >
        <Input
          placeholder="en, es, fr"
          value={store.languages}
          onChange={(e) => store.updateField('languages', e.target.value)}
        />
      </Field>
    </div>
  );
}

// ===========================================================================
// Step 5 - Test Configuration
// ===========================================================================
const testTypes = [
  {
    key: 'test_e2e',
    label: 'E2E Testing',
    description: 'Complete user flow validation from start to finish',
    icon: Layers,
  },
  {
    key: 'test_regression',
    label: 'Regression Testing',
    description: 'Full coverage regression on all features',
    icon: RefreshCcw,
  },
  {
    key: 'test_visual',
    label: 'Visual Regression',
    description: 'Screenshot comparison to detect UI changes',
    icon: Image,
  },
  {
    key: 'test_accessibility',
    label: 'Accessibility',
    description: 'WCAG compliance and accessibility audit',
    icon: Accessibility,
  },
  {
    key: 'test_performance',
    label: 'Performance',
    description: 'Core Web Vitals and load time metrics',
    icon: Gauge,
  },
  {
    key: 'test_api',
    label: 'API Testing',
    description: 'REST/GraphQL endpoint validation',
    icon: Globe,
  },
  {
    key: 'test_cross_browser',
    label: 'Cross-browser',
    description: 'Test across Chrome, Firefox, Safari',
    icon: Monitor,
  },
  {
    key: 'test_responsive',
    label: 'Responsive',
    description: 'Mobile, tablet, and desktop layouts',
    icon: Smartphone,
  },
] as const;

function StepTestConfig() {
  const store = useCreateProjectStore();

  const browserOptions = ['chromium', 'firefox', 'webkit'];
  const deviceOptions = ['mobile', 'tablet', 'desktop'];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Test Configuration"
        description="Choose which types of testing to run and configure browser and device targets."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {testTypes.map(({ key, label, description, icon: Icon }) => {
          const enabled = store[key as keyof typeof store] as boolean;
          return (
            <div
              key={key}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                enabled
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-muted bg-muted/20'
              }`}
            >
              <div
                className={`mt-0.5 rounded-md p-2 ${
                  enabled
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{label}</p>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => store.updateField(key, v)}
                  />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <Field label="Browsers">
          <div className="flex flex-wrap gap-3">
            {browserOptions.map((b) => (
              <label
                key={b}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize hover:bg-muted/50"
              >
                <Checkbox
                  checked={store.browsers.includes(b)}
                  onCheckedChange={() => store.toggleBrowser(b)}
                />
                {b}
              </label>
            ))}
          </div>
        </Field>

        <Field label="Devices">
          <div className="flex flex-wrap gap-3">
            {deviceOptions.map((d) => (
              <label
                key={d}
                className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm capitalize hover:bg-muted/50"
              >
                <Checkbox
                  checked={store.devices.includes(d)}
                  onCheckedChange={() => store.toggleDevice(d)}
                />
                {d}
              </label>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

// ===========================================================================
// Step 6 - Review
// ===========================================================================
function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-primary">{title}</h3>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function StepReview() {
  const store = useCreateProjectStore();

  const enabledTests = testTypes
    .filter(({ key }) => store[key as keyof typeof store])
    .map(({ label }) => label);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Review & Create"
        description="Double-check your project configuration before creating."
      />

      <div className="divide-y rounded-lg border">
        <div className="p-4">
          <ReviewSection title="Project Info">
            <ReviewRow label="Name" value={store.name} />
            <ReviewRow label="URL" value={store.base_url} />
            <ReviewRow
              label="Type"
              value={store.project_type || 'Not specified'}
            />
            <ReviewRow label="Environment" value={store.environment} />
            {store.description && (
              <ReviewRow label="Description" value={store.description} />
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title="Authentication">
            <ReviewRow
              label="Requires Auth"
              value={
                store.requires_auth ? (
                  <Badge variant="info">Yes</Badge>
                ) : (
                  <Badge variant="secondary">No</Badge>
                )
              }
            />
            {store.requires_auth && (
              <>
                <ReviewRow label="Login URL" value={store.login_url} />
                <ReviewRow label="Auth Type" value={store.auth_type} />
                <ReviewRow label="Username" value={store.auth_username} />
              </>
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title="Jira Integration">
            <ReviewRow
              label="Connected"
              value={
                store.connect_jira && store.jira_connected ? (
                  <Badge variant="success">Connected</Badge>
                ) : store.connect_jira ? (
                  <Badge variant="warning">Not verified</Badge>
                ) : (
                  <Badge variant="secondary">Skipped</Badge>
                )
              }
            />
            {store.connect_jira && (
              <>
                <ReviewRow label="Jira URL" value={store.jira_base_url} />
                <ReviewRow label="Project" value={store.jira_project_key} />
                <ReviewRow label="Issue Type" value={store.jira_issue_type} />
                <ReviewRow
                  label="Auto-create"
                  value={store.auto_create_on_failure ? 'Yes' : 'No'}
                />
              </>
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title="Business Context">
            <ReviewRow
              label="Industry"
              value={store.industry || 'Not specified'}
            />
            {store.target_audience && (
              <ReviewRow label="Audience" value={store.target_audience} />
            )}
            {store.compliance.length > 0 && (
              <ReviewRow
                label="Compliance"
                value={
                  <div className="flex flex-wrap gap-1">
                    {store.compliance.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                }
              />
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title="Test Configuration">
            <div className="flex flex-wrap gap-1 py-1">
              {enabledTests.map((t) => (
                <Badge key={t} variant="primarySoft">
                  {t}
                </Badge>
              ))}
            </div>
            <ReviewRow
              label="Browsers"
              value={store.browsers.join(', ')}
            />
            <ReviewRow
              label="Devices"
              value={store.devices.join(', ')}
            />
          </ReviewSection>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Main Wizard
// ===========================================================================
const steps = [
  { label: 'Project Info' },
  { label: 'Authentication' },
  { label: 'Jira' },
  { label: 'Business Context' },
  { label: 'Test Config' },
  { label: 'Review' },
];

export function CreateProjectWizard() {
  const store = useCreateProjectStore();
  const createProject = useCreateProject();
  const navigate = useNavigate();

  const canProceed = (): boolean => {
    switch (store.currentStep) {
      case 0:
        return store.name.trim() !== '' && store.base_url.trim() !== '';
      case 1:
        return true; // auth is optional
      case 2:
        return true; // jira is optional
      case 3:
        return true; // business context is optional
      case 4:
        return store.browsers.length > 0 && store.devices.length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    if (store.currentStep < steps.length - 1) {
      store.setStep(store.currentStep + 1);
    }
  };

  const goBack = () => {
    if (store.currentStep > 0) {
      store.setStep(store.currentStep - 1);
    }
  };

  const mapAuthType = (
    type: string,
  ): 'none' | 'basic' | 'bearer' | 'cookie' | 'custom' => {
    switch (type) {
      case 'email_password':
        return 'basic';
      case 'bearer':
        return 'bearer';
      case 'oauth':
        return 'cookie';
      case 'custom':
        return 'custom';
      default:
        return 'none';
    }
  };

  const handleCreate = async () => {
    try {
      const project = await createProject.mutateAsync({
        name: store.name,
        base_url: store.base_url,
        description: store.description || undefined,
        environment: store.environment as
          | 'development'
          | 'staging'
          | 'production',
        project_type: (store.project_type || undefined) as
          | CreateProjectDto['project_type'],
        auth_config: store.requires_auth
          ? {
              type: mapAuthType(store.auth_type),
              login_url: store.login_url || undefined,
              username: store.auth_username || undefined,
              password: store.auth_password || undefined,
            }
          : undefined,
        industry: store.industry || undefined,
        target_audience: store.target_audience || undefined,
        key_flows: store.key_flows || undefined,
        compliance:
          store.compliance.length > 0 ? store.compliance : undefined,
        languages: store.languages
          ? store.languages.split(',').map((l) => l.trim())
          : undefined,
        test_config: {
          e2e: store.test_e2e,
          regression: store.test_regression,
          visual_regression: store.test_visual,
          accessibility: store.test_accessibility,
          performance: store.test_performance,
          api_testing: store.test_api,
          cross_browser: store.test_cross_browser,
          responsive: store.test_responsive,
          browsers: store.browsers,
          devices: store.devices,
        },
      });

      // If Jira is configured, save Jira config
      if (store.connect_jira && store.jira_connected && store.jira_project_key) {
        try {
          await api.post(`/projects/${project.id}/jira`, {
            base_url: store.jira_base_url,
            email: store.jira_email,
            api_token: store.jira_api_token,
            project_key: store.jira_project_key,
            issue_type: store.jira_issue_type,
            auto_create_on_failure: store.auto_create_on_failure,
          });
        } catch {
          // Jira config save failed but project was created
        }
      }

      store.reset();
      navigate(`/projects/${project.id}`);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Create New Project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your web application for AI-powered QA testing
        </p>
      </div>

      <Stepper steps={steps} currentStep={store.currentStep} className="mb-8" />

      <Card>
        <CardContent className="p-6">
          {store.currentStep === 0 && <StepProjectInfo />}
          {store.currentStep === 1 && <StepAuthentication />}
          {store.currentStep === 2 && <StepJira />}
          {store.currentStep === 3 && <StepBusinessContext />}
          {store.currentStep === 4 && <StepTestConfig />}
          {store.currentStep === 5 && <StepReview />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={store.currentStep === 0}
          >
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/projects')}
          >
            Cancel
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {store.currentStep < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canProceed()}>
              Next
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={createProject.isPending}
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          )}
        </div>
      </div>

      {createProject.isError && (
        <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {createProject.error.message}
        </div>
      )}
    </div>
  );
}

// Type helper used in handleCreate
type CreateProjectDto = Parameters<
  ReturnType<typeof useCreateProject>['mutateAsync']
>[0];
