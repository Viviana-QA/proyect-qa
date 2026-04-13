#!/usr/bin/env node
import { Command } from 'commander';
import { loginCommand } from './commands/login';
import { startCommand } from './commands/start';
import { crawlCommand } from './commands/crawl';

const program = new Command();

program
  .name('qa-agent')
  .description('QA Platform - Local test runner agent')
  .version('0.1.0');

program
  .command('login')
  .description('Authenticate with the QA Platform')
  .action(loginCommand);

program
  .command('start')
  .description('Start the agent and begin polling for test runs')
  .option('-c, --config <path>', 'Path to config file', '.qa-agent.json')
  .option('--headless', 'Run browsers in headless mode', true)
  .option('--no-headless', 'Run browsers in headed mode')
  .action(startCommand);

program
  .command('crawl')
  .description('Crawl a URL and extract page data for AI analysis')
  .argument('<url>', 'URL to crawl')
  .option('-o, --output <path>', 'Output file path')
  .action(crawlCommand);

program.parse();
