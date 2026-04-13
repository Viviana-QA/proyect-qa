import * as readline from 'readline';
import { loadConfig, saveConfig } from '../config/agent-config';
import { ApiClient } from '../connection/api-client';

export async function loginCommand(): Promise<void> {
  const config = loadConfig();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    console.log('\nQA Platform Agent - Login\n');

    if (!config.supabaseUrl) {
      config.supabaseUrl = await question('Supabase URL: ');
    }
    if (!config.supabaseAnonKey) {
      config.supabaseAnonKey = await question('Supabase Anon Key: ');
    }
    if (!config.apiUrl || config.apiUrl === 'http://localhost:3000/api') {
      const apiUrl = await question('Backend API URL (or press Enter for localhost): ');
      if (apiUrl) config.apiUrl = apiUrl;
    }

    const email = await question('Email: ');
    const password = await question('Password: ');

    const client = new ApiClient(config);
    await client.login(email, password);

    // Save config
    saveConfig({
      apiUrl: config.apiUrl,
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      agentId: config.agentId,
    });

    console.log('\nLogin successful! Configuration saved to .qa-agent.json');
    console.log('Run "qa-agent start" to begin polling for test runs.\n');
  } catch (error: any) {
    console.error(`\nLogin failed: ${error.message}\n`);
    process.exit(1);
  } finally {
    rl.close();
  }
}
