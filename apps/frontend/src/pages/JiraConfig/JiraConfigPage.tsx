import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Bug } from 'lucide-react';
import type { JiraConfig } from '@qa/shared-types';

export function JiraConfigPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const [config, setConfig] = useState<JiraConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    jira_base_url: '',
    jira_email: '',
    jira_api_token: '',
    jira_project_key: '',
    issue_type: 'Bug',
    auto_create_on_failure: false,
    label_prefix: 'qa-auto',
  });

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    try {
      const data = await api.get<JiraConfig | null>(
        `/projects/${projectId}/jira-config`,
      );
      if (data) {
        setConfig(data);
        setFormData({
          jira_base_url: data.jira_base_url,
          jira_email: data.jira_email,
          jira_api_token: '',
          jira_project_key: data.jira_project_key,
          issue_type: data.issue_type,
          auto_create_on_failure: data.auto_create_on_failure,
          label_prefix: data.label_prefix,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; message: string }>(
        '/jira/test-connection',
        {
          jira_base_url: formData.jira_base_url,
          jira_email: formData.jira_email,
          jira_api_token: formData.jira_api_token,
        },
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/jira-config`, formData);
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-muted-foreground">{t('jira.loading')}</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('jira.title')}</h1>
        <p className="text-muted-foreground">
          {t('jira.subtitle')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            {t('jira.configuration')}
            {config && <Badge variant="success">{t('jira.connected')}</Badge>}
          </CardTitle>
          <CardDescription>
            {t('jira.configDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('jira.jiraBaseUrl')}</label>
              <Input
                placeholder={t('jira.jiraBaseUrlPlaceholder')}
                value={formData.jira_base_url}
                onChange={(e) => setFormData({ ...formData, jira_base_url: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('jira.email')}</label>
              <Input
                type="email"
                placeholder={t('jira.emailPlaceholder')}
                value={formData.jira_email}
                onChange={(e) => setFormData({ ...formData, jira_email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('jira.apiToken')} {config && t('jira.apiTokenKeepCurrent')}
              </label>
              <Input
                type="password"
                placeholder={t('jira.apiTokenPlaceholder')}
                value={formData.jira_api_token}
                onChange={(e) => setFormData({ ...formData, jira_api_token: e.target.value })}
                required={!config}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('jira.projectKey')}</label>
              <Input
                placeholder={t('jira.projectKeyPlaceholder')}
                value={formData.jira_project_key}
                onChange={(e) => setFormData({ ...formData, jira_project_key: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('jira.issueType')}</label>
                <Input
                  value={formData.issue_type}
                  onChange={(e) => setFormData({ ...formData, issue_type: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('jira.labelPrefix')}</label>
                <Input
                  value={formData.label_prefix}
                  onChange={(e) => setFormData({ ...formData, label_prefix: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoCreate"
                checked={formData.auto_create_on_failure}
                onChange={(e) =>
                  setFormData({ ...formData, auto_create_on_failure: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="autoCreate" className="text-sm font-medium">
                {t('jira.autoCreateOnFailure')}
              </label>
            </div>

            {testResult && (
              <div
                className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.message}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? t('jira.saving') : t('jira.saveConfiguration')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !formData.jira_base_url || !formData.jira_api_token}
              >
                {testing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t('jira.testConnection')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
