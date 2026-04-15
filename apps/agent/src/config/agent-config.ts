import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AgentConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
  agentId: string;
  concurrency: number;
  browsers: string[];
  headless: boolean;
  screenshotsOnFailure: boolean;
  traceOnFailure: boolean;
  retryCount: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  apiUrl: 'http://localhost:3000/api',
  supabaseUrl: '',
  supabaseAnonKey: '',
  geminiApiKey: '',
  agentId: `agent-${os.hostname()}`,
  concurrency: 1,
  browsers: ['chromium'],
  headless: true,
  screenshotsOnFailure: true,
  traceOnFailure: true,
  retryCount: 1,
};

export function loadConfig(configPath: string = '.qa-agent.json'): AgentConfig {
  const fullPath = path.resolve(configPath);

  if (fs.existsSync(fullPath)) {
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const fileConfig = JSON.parse(fileContent);
    return { ...DEFAULT_CONFIG, ...fileConfig };
  }

  // Check home directory
  const homePath = path.join(os.homedir(), '.qa-agent.json');
  if (fs.existsSync(homePath)) {
    const fileContent = fs.readFileSync(homePath, 'utf-8');
    const fileConfig = JSON.parse(fileContent);
    return { ...DEFAULT_CONFIG, ...fileConfig };
  }

  // Use environment variables
  return {
    ...DEFAULT_CONFIG,
    apiUrl: process.env.QA_API_URL || DEFAULT_CONFIG.apiUrl,
    supabaseUrl: process.env.QA_SUPABASE_URL || DEFAULT_CONFIG.supabaseUrl,
    supabaseAnonKey: process.env.QA_SUPABASE_ANON_KEY || DEFAULT_CONFIG.supabaseAnonKey,
    geminiApiKey: process.env.QA_GEMINI_API_KEY || DEFAULT_CONFIG.geminiApiKey,
  };
}

export function saveConfig(config: Partial<AgentConfig>, configPath: string = '.qa-agent.json') {
  const fullPath = path.resolve(configPath);
  const existing = fs.existsSync(fullPath)
    ? JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
    : {};
  fs.writeFileSync(fullPath, JSON.stringify({ ...existing, ...config }, null, 2));
}
