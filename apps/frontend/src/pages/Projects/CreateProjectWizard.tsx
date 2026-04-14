import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const store = useCreateProjectStore();

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t('wizard.step1.title')}
        description={t('wizard.step1.description')}
      />

      <Field label={t('wizard.step1.projectName')} required>
        <Input
          placeholder={t('wizard.step1.projectNamePlaceholder')}
          value={store.name}
          onChange={(e) => store.updateField('name', e.target.value)}
        />
      </Field>

      <Field
        label={t('wizard.step1.baseUrl')}
        required
        hint={t('wizard.step1.baseUrlHint')}
      >
        <Input
          type="url"
          placeholder={t('wizard.step1.baseUrlPlaceholder')}
          value={store.base_url}
          onChange={(e) => store.updateField('base_url', e.target.value)}
        />
      </Field>

      <Field label={t('wizard.step1.projectType')}>
        <Select
          value={store.project_type}
          onChange={(v) => store.updateField('project_type', v)}
        >
          <option value="">{t('wizard.step1.selectType')}</option>
          <option value="web_app">{t('wizard.step1.typeWebApp')}</option>
          <option value="ecommerce">{t('wizard.step1.typeEcommerce')}</option>
          <option value="saas">{t('wizard.step1.typeSaas')}</option>
          <option value="landing_page">{t('wizard.step1.typeLandingPage')}</option>
          <option value="mobile_web">{t('wizard.step1.typeMobileWeb')}</option>
          <option value="api">{t('wizard.step1.typeApi')}</option>
          <option value="custom">{t('wizard.step1.typeCustom')}</option>
        </Select>
      </Field>

      <Field label={t('wizard.step1.environment')}>
        <Select
          value={store.environment}
          onChange={(v) => store.updateField('environment', v)}
        >
          <option value="development">{t('wizard.step1.envDevelopment')}</option>
          <option value="staging">{t('wizard.step1.envStaging')}</option>
          <option value="production">{t('wizard.step1.envProduction')}</option>
        </Select>
      </Field>

      <Field label={t('wizard.step1.descriptionLabel')} hint={t('wizard.step1.descriptionHint')}>
        <Textarea
          placeholder={t('wizard.step1.descriptionPlaceholder')}
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
  const { t } = useTranslation();
  const store = useCreateProjectStore();

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t('wizard.step2.title')}
        description={t('wizard.step2.description')}
      />

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{t('wizard.step2.requiresLogin')}</p>
          <p className="text-xs text-muted-foreground">
            {t('wizard.step2.requiresLoginHint')}
          </p>
        </div>
        <Switch
          checked={store.requires_auth}
          onCheckedChange={(v) => store.updateField('requires_auth', v)}
        />
      </div>

      {store.requires_auth && (
        <div className="space-y-5 rounded-lg border border-dashed p-4">
          <Field label={t('wizard.step2.loginUrl')} hint={t('wizard.step2.loginUrlHint')}>
            <Input
              type="url"
              placeholder={t('wizard.step2.loginUrlPlaceholder')}
              value={store.login_url}
              onChange={(e) => store.updateField('login_url', e.target.value)}
            />
          </Field>

          <Field label={t('wizard.step2.authType')}>
            <Select
              value={store.auth_type}
              onChange={(v) => store.updateField('auth_type', v)}
            >
              <option value="">{t('wizard.step2.selectAuthType')}</option>
              <option value="email_password">{t('wizard.step2.authEmailPassword')}</option>
              <option value="oauth">{t('wizard.step2.authOAuth')}</option>
              <option value="bearer">{t('wizard.step2.authBearer')}</option>
              <option value="custom">{t('wizard.step2.authCustom')}</option>
            </Select>
          </Field>

          <Field label={t('wizard.step2.usernameEmail')}>
            <Input
              placeholder={t('wizard.step2.usernamePlaceholder')}
              value={store.auth_username}
              onChange={(e) =>
                store.updateField('auth_username', e.target.value)
              }
            />
          </Field>

          <Field label={t('wizard.step2.password')}>
            <Input
              type="password"
              placeholder={t('wizard.step2.passwordPlaceholder')}
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
  const { t } = useTranslation();
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
        err instanceof Error ? err.message : t('wizard.step3.connectionFailed'),
      );
      store.updateField('jira_connected', false);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t('wizard.step3.title')}
        description={t('wizard.step3.description')}
      />

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium">{t('wizard.step3.connectToJira')}</p>
          <p className="text-xs text-muted-foreground">
            {t('wizard.step3.connectToJiraHint')}
          </p>
        </div>
        <Switch
          checked={store.connect_jira}
          onCheckedChange={(v) => store.updateField('connect_jira', v)}
        />
      </div>

      {store.connect_jira && (
        <div className="space-y-5 rounded-lg border border-dashed p-4">
          <Field label={t('wizard.step3.jiraBaseUrl')}>
            <Input
              placeholder={t('wizard.step3.jiraBaseUrlPlaceholder')}
              value={store.jira_base_url}
              onChange={(e) =>
                store.updateField('jira_base_url', e.target.value)
              }
            />
          </Field>

          <Field label={t('wizard.step3.jiraEmail')}>
            <Input
              type="email"
              placeholder={t('wizard.step3.jiraEmailPlaceholder')}
              value={store.jira_email}
              onChange={(e) =>
                store.updateField('jira_email', e.target.value)
              }
            />
          </Field>

          <Field
            label={t('wizard.step3.apiToken')}
            hint={t('wizard.step3.apiTokenHint')}
          >
            <Input
              type="password"
              placeholder={t('wizard.step3.apiTokenPlaceholder')}
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
              {t('wizard.step3.testConnection')}
            </Button>

            {testResult === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {t('wizard.step3.connectedSuccessfully')}
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
              <Field label={t('wizard.step3.jiraProject')}>
                <Select
                  value={store.jira_project_key}
                  onChange={(v) =>
                    store.updateField('jira_project_key', v)
                  }
                >
                  <option value="">{t('wizard.step3.selectProject')}</option>
                  {projects.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.key})
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('wizard.step3.issueType')}>
                <Select
                  value={store.jira_issue_type}
                  onChange={(v) =>
                    store.updateField('jira_issue_type', v)
                  }
                >
                  <option value="Bug">{t('wizard.step3.issueTypeBug')}</option>
                  <option value="Task">{t('wizard.step3.issueTypeTask')}</option>
                  <option value="Story">{t('wizard.step3.issueTypeStory')}</option>
                </Select>
              </Field>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">
                    {t('wizard.step3.autoCreateOnFailure')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('wizard.step3.autoCreateOnFailureHint')}
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
  const { t } = useTranslation();
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
        title={t('wizard.step4.title')}
        description={t('wizard.step4.description')}
      />

      <Field label={t('wizard.step4.industry')}>
        <Select
          value={store.industry}
          onChange={(v) => store.updateField('industry', v)}
        >
          <option value="">{t('wizard.step4.selectIndustry')}</option>
          <option value="ecommerce">{t('wizard.step4.industryEcommerce')}</option>
          <option value="healthcare">{t('wizard.step4.industryHealthcare')}</option>
          <option value="finance">{t('wizard.step4.industryFinance')}</option>
          <option value="education">{t('wizard.step4.industryEducation')}</option>
          <option value="social_media">{t('wizard.step4.industrySocialMedia')}</option>
          <option value="enterprise_saas">{t('wizard.step4.industryEnterpriseSaas')}</option>
          <option value="government">{t('wizard.step4.industryGovernment')}</option>
          <option value="media">{t('wizard.step4.industryMedia')}</option>
          <option value="travel">{t('wizard.step4.industryTravel')}</option>
          <option value="other">{t('wizard.step4.industryOther')}</option>
        </Select>
      </Field>

      <Field
        label={t('wizard.step4.targetAudience')}
        hint={t('wizard.step4.targetAudienceHint')}
      >
        <Textarea
          placeholder={t('wizard.step4.targetAudiencePlaceholder')}
          value={store.target_audience}
          onChange={(e) =>
            store.updateField('target_audience', e.target.value)
          }
        />
      </Field>

      <Field
        label={t('wizard.step4.keyBusinessFlows')}
        hint={t('wizard.step4.keyBusinessFlowsHint')}
      >
        <Textarea
          placeholder={t('wizard.step4.keyBusinessFlowsPlaceholder')}
          value={store.key_flows}
          onChange={(e) => store.updateField('key_flows', e.target.value)}
        />
      </Field>

      <Field label={t('wizard.step4.complianceRequirements')}>
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
        label={t('wizard.step4.languages')}
        hint={t('wizard.step4.languagesHint')}
      >
        <Input
          placeholder={t('wizard.step4.languagesPlaceholder')}
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
function StepTestConfig() {
  const { t } = useTranslation();
  const store = useCreateProjectStore();

  const testTypes = [
    {
      key: 'test_e2e',
      label: t('wizard.step5.e2eLabel'),
      description: t('wizard.step5.e2eDesc'),
      icon: Layers,
    },
    {
      key: 'test_regression',
      label: t('wizard.step5.regressionLabel'),
      description: t('wizard.step5.regressionDesc'),
      icon: RefreshCcw,
    },
    {
      key: 'test_visual',
      label: t('wizard.step5.visualLabel'),
      description: t('wizard.step5.visualDesc'),
      icon: Image,
    },
    {
      key: 'test_accessibility',
      label: t('wizard.step5.accessibilityLabel'),
      description: t('wizard.step5.accessibilityDesc'),
      icon: Accessibility,
    },
    {
      key: 'test_performance',
      label: t('wizard.step5.performanceLabel'),
      description: t('wizard.step5.performanceDesc'),
      icon: Gauge,
    },
    {
      key: 'test_api',
      label: t('wizard.step5.apiLabel'),
      description: t('wizard.step5.apiDesc'),
      icon: Globe,
    },
    {
      key: 'test_cross_browser',
      label: t('wizard.step5.crossBrowserLabel'),
      description: t('wizard.step5.crossBrowserDesc'),
      icon: Monitor,
    },
    {
      key: 'test_responsive',
      label: t('wizard.step5.responsiveLabel'),
      description: t('wizard.step5.responsiveDesc'),
      icon: Smartphone,
    },
  ] as const;

  const browserOptions = ['chromium', 'firefox', 'webkit'];
  const deviceOptions = ['mobile', 'tablet', 'desktop'];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('wizard.step5.title')}
        description={t('wizard.step5.description')}
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
        <Field label={t('wizard.step5.browsers')}>
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

        <Field label={t('wizard.step5.devices')}>
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
  const { t } = useTranslation();
  const store = useCreateProjectStore();

  const testTypeLabels: Record<string, string> = {
    test_e2e: t('wizard.step5.e2eLabel'),
    test_regression: t('wizard.step5.regressionLabel'),
    test_visual: t('wizard.step5.visualLabel'),
    test_accessibility: t('wizard.step5.accessibilityLabel'),
    test_performance: t('wizard.step5.performanceLabel'),
    test_api: t('wizard.step5.apiLabel'),
    test_cross_browser: t('wizard.step5.crossBrowserLabel'),
    test_responsive: t('wizard.step5.responsiveLabel'),
  };

  const enabledTests = Object.entries(testTypeLabels)
    .filter(([key]) => store[key as keyof typeof store])
    .map(([, label]) => label);

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('wizard.step6.title')}
        description={t('wizard.step6.description')}
      />

      <div className="divide-y rounded-lg border">
        <div className="p-4">
          <ReviewSection title={t('wizard.step6.projectInfo')}>
            <ReviewRow label={t('wizard.step6.name')} value={store.name} />
            <ReviewRow label={t('wizard.step6.url')} value={store.base_url} />
            <ReviewRow
              label={t('wizard.step6.type')}
              value={store.project_type || t('wizard.step6.notSpecified')}
            />
            <ReviewRow label={t('wizard.step6.environment')} value={store.environment} />
            {store.description && (
              <ReviewRow label={t('wizard.step6.descriptionLabel')} value={store.description} />
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title={t('wizard.step6.authentication')}>
            <ReviewRow
              label={t('wizard.step6.requiresAuth')}
              value={
                store.requires_auth ? (
                  <Badge variant="info">{t('common.yes')}</Badge>
                ) : (
                  <Badge variant="secondary">{t('common.no')}</Badge>
                )
              }
            />
            {store.requires_auth && (
              <>
                <ReviewRow label={t('wizard.step6.loginUrl')} value={store.login_url} />
                <ReviewRow label={t('wizard.step6.authType')} value={store.auth_type} />
                <ReviewRow label={t('wizard.step6.username')} value={store.auth_username} />
              </>
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title={t('wizard.step6.jiraIntegration')}>
            <ReviewRow
              label={t('wizard.step6.connected')}
              value={
                store.connect_jira && store.jira_connected ? (
                  <Badge variant="success">{t('wizard.step6.connected')}</Badge>
                ) : store.connect_jira ? (
                  <Badge variant="warning">{t('wizard.step6.notVerified')}</Badge>
                ) : (
                  <Badge variant="secondary">{t('wizard.step6.skipped')}</Badge>
                )
              }
            />
            {store.connect_jira && (
              <>
                <ReviewRow label={t('wizard.step6.jiraUrl')} value={store.jira_base_url} />
                <ReviewRow label={t('wizard.step6.project')} value={store.jira_project_key} />
                <ReviewRow label={t('wizard.step6.issueType')} value={store.jira_issue_type} />
                <ReviewRow
                  label={t('wizard.step6.autoCreate')}
                  value={store.auto_create_on_failure ? t('common.yes') : t('common.no')}
                />
              </>
            )}
          </ReviewSection>
        </div>

        <div className="p-4">
          <ReviewSection title={t('wizard.step6.businessContext')}>
            <ReviewRow
              label={t('wizard.step6.industry')}
              value={store.industry || t('wizard.step6.notSpecified')}
            />
            {store.target_audience && (
              <ReviewRow label={t('wizard.step6.audience')} value={store.target_audience} />
            )}
            {store.compliance.length > 0 && (
              <ReviewRow
                label={t('wizard.step6.compliance')}
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
          <ReviewSection title={t('wizard.step6.testConfiguration')}>
            <div className="flex flex-wrap gap-1 py-1">
              {enabledTests.map((tt) => (
                <Badge key={tt} variant="primarySoft">
                  {tt}
                </Badge>
              ))}
            </div>
            <ReviewRow
              label={t('wizard.step6.browsers')}
              value={store.browsers.join(', ')}
            />
            <ReviewRow
              label={t('wizard.step6.devices')}
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
export function CreateProjectWizard() {
  const { t } = useTranslation();
  const store = useCreateProjectStore();
  const createProject = useCreateProject();
  const navigate = useNavigate();

  const steps = [
    { label: t('wizard.step1.label') },
    { label: t('wizard.step2.label') },
    { label: t('wizard.step3.label') },
    { label: t('wizard.step4.label') },
    { label: t('wizard.step5.label') },
    { label: t('wizard.step6.label') },
  ];

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
        <h1 className="text-2xl font-semibold">{t('wizard.createNewProject')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('wizard.createNewProjectDesc')}
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
            {t('wizard.back')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/projects')}
          >
            {t('wizard.cancel')}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {store.currentStep < steps.length - 1 ? (
            <Button onClick={goNext} disabled={!canProceed()}>
              {t('wizard.next')}
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={createProject.isPending}
            >
              {createProject.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('wizard.creating')}
                </>
              ) : (
                t('wizard.createProject')
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
