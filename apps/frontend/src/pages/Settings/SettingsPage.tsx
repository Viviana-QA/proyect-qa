import { useAuthStore } from '@/stores/auth.store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">User ID</span>
            <code className="text-xs">{user?.id}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QA Agent Setup</CardTitle>
          <CardDescription>
            Install and configure the local test runner agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">1. Install the agent globally</p>
            <code className="block rounded-md bg-muted p-3 text-sm">
              npm install -g @qa/agent
            </code>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">2. Login with your account</p>
            <code className="block rounded-md bg-muted p-3 text-sm">
              qa-agent login
            </code>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">3. Start the agent</p>
            <code className="block rounded-md bg-muted p-3 text-sm">
              qa-agent start
            </code>
          </div>
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
            The agent polls the server for pending test runs and executes them locally using Playwright.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Environment variables for your setup</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="font-mono">VITE_SUPABASE_URL</span>
              <Badge variant="secondary">Required</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>
              <Badge variant="secondary">Required</Badge>
            </div>
            <div className="flex justify-between rounded bg-muted p-2">
              <span className="font-mono">VITE_API_URL</span>
              <Badge variant="secondary">Required</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
