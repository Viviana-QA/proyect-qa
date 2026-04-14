import { useAuthStore } from '@/stores/auth.store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';

export function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{t('settings.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile')}</CardTitle>
          <CardDescription>{t('settings.profileDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('settings.email')}</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t('settings.userId')}</span>
            <code className="text-xs">{user?.id}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.qaAgentSetup')}</CardTitle>
          <CardDescription>
            {t('settings.qaAgentSetupDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">{t('settings.step1Title')}</p>
            <code className="block rounded-md bg-muted p-3 text-sm">
              {t('settings.step1Command')}
            </code>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('settings.step2Title')}</p>
            <code className="block rounded-md bg-muted p-3 text-sm">
              {t('settings.step2Command')}
            </code>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('settings.step3Title')}</p>
            <code className="block rounded-md bg-muted p-3 text-sm">
              {t('settings.step3Command')}
            </code>
          </div>
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            {t('settings.agentInfo')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.apiConfiguration')}</CardTitle>
          <CardDescription>{t('settings.apiConfigDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="font-mono">VITE_SUPABASE_URL</span>
              <Badge variant="secondary">{t('settings.required')}</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>
              <Badge variant="secondary">{t('settings.required')}</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="font-mono">VITE_API_URL</span>
              <Badge variant="secondary">{t('settings.required')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
