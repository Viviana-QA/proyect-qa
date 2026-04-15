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

    // Display detected frameworks
    if (analysis.detected_frameworks && analysis.detected_frameworks.length > 0) {
      console.log(`\nDetected Frameworks: ${analysis.detected_frameworks.join(', ')}`);
    } else {
      console.log('\nDetected Frameworks: none');
    }

    // Display performance data
    if (analysis.performance_data) {
      console.log('\nPerformance Metrics:');
      console.table({
        'DOM Content Loaded': `${analysis.performance_data.domContentLoaded}ms`,
        'Page Load': `${analysis.performance_data.load}ms`,
        'First Paint': `${analysis.performance_data.firstPaint}ms`,
      });
    }

    // Display meta tags summary
    if (analysis.meta_tags && analysis.meta_tags.length > 0) {
      console.log(`\nMeta Tags (${analysis.meta_tags.length}):`);
      for (const tag of analysis.meta_tags.slice(0, 10)) {
        console.log(`  ${tag.name}: ${tag.content.substring(0, 80)}`);
      }
      if (analysis.meta_tags.length > 10) {
        console.log(`  ... and ${analysis.meta_tags.length - 10} more`);
      }
    }

    // Display accessibility tree summary
    if (analysis.accessibility_tree) {
      const tree = analysis.accessibility_tree;
      const childCount = tree.children ? tree.children.length : 0;
      console.log(
        `\nAccessibility Tree: root role="${tree.role || 'WebArea'}", ${childCount} top-level children`,
      );
    }

    // Display console errors
    if (analysis.console_errors && analysis.console_errors.length > 0) {
      console.log(`\nConsole Errors (${analysis.console_errors.length}):`);
      for (const err of analysis.console_errors.slice(0, 5)) {
        console.log(`  [ERROR] ${err.substring(0, 120)}`);
      }
      if (analysis.console_errors.length > 5) {
        console.log(`  ... and ${analysis.console_errors.length - 5} more`);
      }
    }

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
