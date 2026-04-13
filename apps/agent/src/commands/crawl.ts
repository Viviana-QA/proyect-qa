import * as fs from 'fs';
import { crawlPage } from '../runner/page-crawler';

export async function crawlCommand(
  url: string,
  options: { output?: string },
): Promise<void> {
  console.log(`\nCrawling ${url}...\n`);

  try {
    const analysis = await crawlPage(url);

    const summary = {
      title: analysis.title,
      url: analysis.url,
      interactive_elements: analysis.interactive_elements.length,
      navigation_links: analysis.navigation_links.length,
      forms: analysis.forms.length,
      aria_landmarks: analysis.aria_landmarks.length,
      api_endpoints: analysis.api_endpoints.length,
      page_routes: analysis.page_routes.length,
    };

    console.log('Page Analysis Summary:');
    console.table(summary);

    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(analysis, null, 2));
      console.log(`\nFull analysis saved to ${options.output}`);
    } else {
      console.log('\nUse --output <path> to save the full analysis to a file');
    }
  } catch (error: any) {
    console.error(`Crawl failed: ${error.message}`);
    process.exit(1);
  }
}
