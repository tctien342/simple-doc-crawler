import * as cheerio from 'cheerio';
import PQueue from 'p-queue';
import * as path from 'path';
import * as fs from 'fs/promises';
import { CrawlerConfig, PageData } from './interfaces.js';
import { BloomFilter } from 'bloom-filters';

export class ParallelCrawler {
  private queue: PQueue;
  private visited = new Set<string>();
  private bloomFilter = new BloomFilter(10000, 5);
  private config: CrawlerConfig;
  private maxUrlsPerDomain: number;
  private urlCount = 0;
  private timeout: number;
  private startTime: number;
  private maxRunTime: number;
  private shouldStop = false;

  constructor(config: CrawlerConfig) {
    this.config = config;
    this.queue = new PQueue({ concurrency: config.maxConcurrency });
    this.startTime = Date.now();

    // Initialize configurable parameters with defaults if not provided
    this.maxUrlsPerDomain = config.maxUrlsPerDomain ?? 200;
    this.timeout = config.requestTimeout ?? 5000;
    this.maxRunTime = config.maxRunTime ?? 30000;

    // Set a global timeout to stop crawling after maxRunTime
    setTimeout(() => {
      this.stopCrawling('Reached maximum run time');
    }, this.maxRunTime);
  }

  /**
   * Stop the crawling process gracefully
   */
  private stopCrawling(reason: string): void {
    if (!this.shouldStop) {
      console.log(`\n${reason}. Stopping crawler.`);
      this.shouldStop = true;

      // Clear the queue
      this.queue.clear();
      this.queue.pause();
    }
  }

  /**
   * Start crawling from a seed URL
   */
  async crawl(seedUrl: string): Promise<PageData[]> {
    try {
      const parsedUrl = new URL(seedUrl);
      const baseDomain = parsedUrl.hostname;
      const results: PageData[] = [];

      // Create output directory if it doesn't exist
      await fs.mkdir(this.config.outputDir, { recursive: true });

      console.log(`Starting crawler with max ${this.maxUrlsPerDomain} URLs and ${this.config.maxConcurrency} concurrent requests`);
      console.log(`Request timeout: ${this.timeout / 1000}s, Max run time: ${this.maxRunTime / 1000}s`);

      // Process the seed URL directly first
      await this.processUrl(seedUrl, baseDomain, results);

      // Only add more URLs to the queue if the seed was processed successfully
      if (results.length > 0 && !this.shouldStop) {
        // Get the links from the first page
        const seedPageLinks = results.flatMap(result => this.filterLinks(result.links, seedUrl, baseDomain));

        // Add them to the queue
        for (const link of seedPageLinks) {
          if (this.shouldStop) break;
          if (!this.isVisited(link)) {
            this.queue.add(() => this.processUrl(link, baseDomain, results));
          }
        }

        try {
          await this.queue.onEmpty();
        } catch (err) {
          console.log('Queue processing error:', (err as Error).message);
        }
      }

      const elapsedTime = (Date.now() - this.startTime) / 1000;
      console.log(`\nCrawling completed. Processed ${results.length} pages in ${elapsedTime.toFixed(1)}s.`);

      // Even if we have no results, at least include the seed URL
      if (results.length === 0) {
        results.push({
          url: seedUrl,
          content: '<h1>Failed to load content</h1><p>The crawler was unable to process this page.</p>',
          links: [],
          title: 'Failed to Load Content'
        });
      }

      return results;
    } catch (error) {
      console.error('Error during crawling:', error);

      // Return at least the seed URL with an error message
      return [{
        url: seedUrl,
        content: '<h1>Error</h1><p>An error occurred while crawling: ' + (error as Error).message + '</p>',
        links: [],
        title: 'Error'
      }];
    }
  }

  /**
   * Process a single URL
   */
  private async processUrl(
    url: string,
    baseDomain: string,
    results: PageData[]
  ): Promise<void> {
    // Clean URL, without query and selectors
    url = url.split('?')[0].split('#')[0];
    // Check if we should stop
    if (this.shouldStop) {
      return;
    }

    // Skip if already visited
    if (this.isVisited(url)) {
      return;
    }

    // Skip URLs with fragments
    if (url.includes('#')) {
      url = url.split('#')[0];
      if (this.isVisited(url)) {
        return;
      }
    }

    // Skip if we've reached the maximum number of URLs
    if (this.urlCount >= this.maxUrlsPerDomain) {
      this.stopCrawling('Reached maximum number of URLs');
      return;
    }

    // Mark as visited and increment counter
    this.markVisited(url);
    this.urlCount++;

    try {
      process.stdout.write(`\rProcessing: ${this.urlCount}/${this.maxUrlsPerDomain} pages`);

      // Fetch and parse the page
      const { content, links, title } = await this.fetchPage(url);

      // Add to results only if content was successfully fetched
      if (content) {
        results.push({ url, content, links, title });
      }

      // Check again if we should stop
      if (this.shouldStop) {
        return;
      }

      // Queue discovered links (limited to avoid overwhelming the queue)
      const limitedLinks = this.filterLinks(links, url, baseDomain); // Only 5 links per page max
      for (const link of limitedLinks) {
        // Check if we have capacity and should continue
        if (this.shouldStop || this.urlCount >= this.maxUrlsPerDomain) {
          break;
        }

        // Only add to queue if we haven't visited and are under limits
        if (!this.isVisited(link)) {
          this.queue.add(() => this.processUrl(link, baseDomain, results));
        }
      }
    } catch (error) {
      if (!this.shouldStop) {
        console.error(`\nError processing ${url}:`, error);
      }
    }
  }

  /**
   * Filter links to valid candidates for crawling
   */
  private filterLinks(links: string[], currentUrl: string, baseDomain: string): string[] {
    return links.filter(link => {
      try {
        const url = new URL(link);

        // Skip non-http protocols
        if (!url.protocol.startsWith('http')) {
          return false;
        }

        // Skip fragments
        if (url.hash) {
          // Remove the hash
          url.hash = '';
          link = url.toString();
        }

        // Skip URLs that go outside the base domain if sameDomain is true
        if (this.config.sameDomain && url.hostname !== baseDomain) {
          return false;
        }

        // Skip common file types we don't want to process
        const ext = path.extname(url.pathname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.css', '.js'].includes(ext)) {
          return false;
        }

        // Skip URLs with query parameters if they're too complex
        if (url.search && url.search.length > 20) {
          return false;
        }

        // Skip URLs that don't match any of the allowed prefixes (if specified)
        if (this.config.allowedPrefixes && this.config.allowedPrefixes.length > 0) {
          const fullUrl = url.toString();
          const matchesPrefix = this.config.allowedPrefixes.some(prefix =>
            fullUrl.startsWith(prefix));

          if (!matchesPrefix) {
            return false;
          }
        }

        // Skip URLs that match any of the ignore prefixes (if specified)
        if (this.config.ignorePrefixes && this.config.ignorePrefixes.length > 0) {
          const fullUrl = url.toString();
          const matchesIgnorePrefix = this.config.ignorePrefixes.some(prefix =>
            fullUrl.startsWith(prefix));

          if (matchesIgnorePrefix) {
            return false;
          }
        }

        return true;
      } catch (e) {
        return false;
      }
    });
  }

  /**
   * Fetch a page and extract content and links
   */
  private async fetchPage(pageUrl: string): Promise<{ content: string; links: string[]; title?: string }> {
    try {
      if (this.shouldStop) {
        return { content: '', links: [] };
      }

      // Fetch the page with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 DocCrawler/1.0' },
        signal: controller.signal
      }).catch(err => {
        return { statusCode: 0, body: { text: () => Promise.resolve('') } };
      });

      clearTimeout(timeoutId);

      if ("statusCode" in response) {
        return { content: '', links: [] };
      }

      const html = await response.text();
      if (!html) {
        return { content: '', links: [] };
      }

      const $ = cheerio.load(html);

      // Extract title
      const title = $('title').text().trim();

      // Extract all links
      const links: string[] = [];
      $('a').each((_, element) => {
        const href = $(element).attr('href');
        if (href) {
          try {
            // Resolve relative URLs
            const absoluteUrl = new URL(href, pageUrl).toString();
            links.push(absoluteUrl);
          } catch (e) {
            // Skip invalid URLs
          }
        }
      });

      // Return the page data
      return {
        content: html,
        links,
        title
      };
    } catch (error) {
      return { content: '', links: [] };
    }
  }

  /**
   * Check if a URL has been visited
   */
  private isVisited(url: string): boolean {
    return this.visited.has(url) || this.bloomFilter.has(url);
  }

  /**
   * Mark a URL as visited
   */
  private markVisited(url: string): void {
    this.visited.add(url);
    this.bloomFilter.add(url);
  }
}