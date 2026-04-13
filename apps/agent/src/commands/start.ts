import { loadConfig } from '../config/agent-config';
import { ApiClient } from '../connection/api-client';
import { PlaywrightRunner } from '../runner/playwright-runner';
import { PollingService } from '../connection/polling-service';

export async function startCommand(options: {
  config?: string;
  headless?: boolean;
}): Promise<void> {
  const config = loadConfig(options.config);

  if (options.headless !== undefined) {
    config.headless = options.headless;
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.error('Missing Supabase configuration. Run "qa-agent login" first.');
    process.exit(1);
  }

  console.log('\nQA Platform Agent');
  console.log(`Agent ID: ${config.agentId}`);
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`Headless: ${config.headless}`);
  console.log(`Browsers: ${config.browsers.join(', ')}\n`);

  const apiClient = new ApiClient(config);

  // Restore session
  const hasSession = await apiClient.restoreSession();
  if (!hasSession) {
    console.error('No active session. Run "qa-agent login" first.');
    process.exit(1);
  }
  console.log('Session restored successfully');

  const runner = new PlaywrightRunner(config);
  const poller = new PollingService(apiClient, runner);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down...');
    poller.stop();
  });
  process.on('SIGTERM', () => {
    poller.stop();
  });

  await poller.start();
}
