#!/usr/bin/env bun
import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ParallelCrawler } from './crawler.js';
import { DocumentConverter } from './converter.js';
import { CrawlerConfig } from './interfaces.js';

// Define CLI program
const program = new Command();

program
  .name('doc-export')
  .description('A CLI tool to crawl documentation sites and export them to Markdown')
  .version('1.0.0');

program
  .requiredOption('-u, --url <url>', 'URL to start crawling from')
  .requiredOption('-o, --output <output>', 'Output directory for the exported document')
  .option('-c, --concurrency <concurrency>', 'Maximum number of concurrent requests', '5')
  .option('-s, --same-domain', 'Only crawl pages within the same domain', true)
  .option('-m, --max-urls <number>', 'Maximum URLs to crawl per domain', '200')
  .option('--request-timeout <milliseconds>', 'Request timeout in milliseconds', '5000')
  .option('--max-runtime <milliseconds>', 'Maximum crawler run time in milliseconds', '30000')
  .option('--split-pages <mode>', 'How to split pages: "none" (default), "subdirectories", or "flat"', 'none')
  .option('--allowed-prefixes <prefixes>', 'Comma-separated list of URL prefixes to crawl (e.g., "https://example.com/docs/,https://example.com/guides/")')
  .addHelpText('after', `
Split Pages Modes:
  - none: All pages combined into a single document.md file (default)
  - subdirectories: Each page saved as a separate file in a pages/ subdirectory
  - flat: Each page saved as a separate file in the output directory with domain name in filename
    (e.g., example_com_page1.md)

URL Prefix Filtering:
  Use --allowed-prefixes to only crawl pages with specific URL prefixes.
  Multiple prefixes can be specified as a comma-separated list.

Examples:
  $ bun run src/index.ts --url https://example.com --split-pages none
  $ bun run src/index.ts --url https://example.com --split-pages subdirectories
  $ bun run src/index.ts --url https://example.com --split-pages flat
  $ bun run src/index.ts --url https://example.com --allowed-prefixes https://example.com/docs/,https://example.com/guides/
`)
  .action(async (options) => {
    try {
      console.time('Total execution time');

      // Parse options
      const config: CrawlerConfig = {
        maxConcurrency: parseInt(options.concurrency),
        sameDomain: options.sameDomain,
        outputDir: path.resolve(options.output),
        maxUrlsPerDomain: parseInt(options.maxUrls),
        requestTimeout: parseInt(options.requestTimeout),
        maxRunTime: parseInt(options.maxRuntime),
        splitPages: options.splitPages === true ? 'subdirectories' :
                   (options.splitPages === false ? 'none' :
                   (options.splitPages === 'true' ? 'subdirectories' :
                   (options.splitPages === 'false' ? 'none' : options.splitPages)))
      };

      // Parse allowed prefixes if provided
      if (options.allowedPrefixes) {
        config.allowedPrefixes = options.allowedPrefixes.split(',').map((prefix: string) => prefix.trim());
        console.log(`Using URL prefix filter: ${config.allowedPrefixes!.join(', ')}`);
      }

      // Validate options
      if (isNaN(config.maxConcurrency) || config.maxConcurrency <= 0) {
        console.error('Error: Concurrency must be a positive number');
        process.exit(1);
      }

      if (isNaN(config.maxUrlsPerDomain!) || config.maxUrlsPerDomain! <= 0) {
        console.error('Error: Max URLs per domain must be a positive number');
        process.exit(1);
      }

      if (isNaN(config.requestTimeout!) || config.requestTimeout! <= 0) {
        console.error('Error: Request timeout must be a positive number');
        process.exit(1);
      }

      if (isNaN(config.maxRunTime!) || config.maxRunTime! <= 0) {
        console.error('Error: Max runtime must be a positive number');
        process.exit(1);
      }

      // Ensure output directory exists
      await fs.mkdir(config.outputDir, { recursive: true });

      // Initialize components
      console.log(`[1/4] Initializing crawler (${config.maxConcurrency} parallel workers)`);
      const crawler = new ParallelCrawler(config);
      const converter = new DocumentConverter();

      // Start crawling
      const startTime = performance.now();
      const pages = await crawler.crawl(options.url);
      const crawlDuration = ((performance.now() - startTime) / 1000).toFixed(1);

      console.log(`[2/4] Found ${pages.length} pages in ${crawlDuration}s`);

      // Check if we have any pages
      if (pages.length === 0) {
        console.error('No pages were successfully crawled. Please try with a different URL or increase the timeout settings.');
        process.exit(1);
      }

      // Process HTML to Markdown
      const markdownStartTime = performance.now();
      const markdownPath = await converter.processPages(pages, config.outputDir, config.splitPages);
      const markdownDuration = ((performance.now() - markdownStartTime) / 1000).toFixed(1);

      // Get markdown file size
      const stats = await fs.stat(markdownPath);
      const markdownSizeMB = (stats.size / (1024 * 1024)).toFixed(1);

      console.log(`[3/4] Converted ${pages.length} pages to Markdown (${markdownSizeMB}MB)`);

      // Generate document
      const outputFilePath = await converter.generatePDF(markdownPath, config.outputDir);

      console.log(`[4/4] Document generated: ${path.basename(outputFilePath)}`);
      console.timeEnd('Total execution time');

      console.log(`\nOutput file: ${outputFilePath}`);
      console.log('\nNote: PDF generation is currently provided as Markdown format.');
      console.log('You can convert the Markdown file to PDF using a third-party tool if needed.');
    } catch (error) {
      console.error('Error:', error);
    }
    process.exit(0);
  });

// Parse command line arguments
program.parse(process.argv);