/**
 * Configuration for the crawler
 */
export interface CrawlerConfig {
  maxConcurrency: number;
  sameDomain: boolean;
  outputDir: string;
  maxUrlsPerDomain?: number; // Maximum URLs to crawl per domain
  requestTimeout?: number;   // Request timeout in milliseconds
  maxRunTime?: number;       // Maximum crawler run time in milliseconds
  splitPages?: 'none' | 'subdirectories' | 'flat';  // How to split pages into markdown files
}

/**
 * Data structure for a crawled page
 */
export interface PageData {
  url: string;
  content: string;
  links: string[];
  title?: string;
}