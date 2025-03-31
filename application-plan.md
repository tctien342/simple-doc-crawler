Here's a structured plan for your Node.js/TypeScript CLI document-to-PDF converter:

1. **Core Architecture**

```typescript
interface CrawlerConfig {
  maxConcurrency: number;
  sameDomain: boolean;
  outputDir: string;
}

interface PageData {
  url: string;
  content: string;
  links: string[];
}
```

2. **Implementation Phases**

A. **CLI Setup**

- Use `commander` for argument parsing
- Required arguments: `--url`, `--output`
- Optional: `--concurrency` (default: 10)

B. **Enhanced Crawler**

```typescript
class ParallelCrawler {
  private visited = new Set<string>();
  private queue = new PQueue({ concurrency: config.maxConcurrency });

  async crawl(url: string): Promise<PageData[]> {
    // Implementation with:
    // 1. Domain validation using URL module
    // 2. Fetch with timeout (5s)
    // 3. Link extraction with cheerio
    // 4. Automatic queue management
  }
}
```

C. **Conversion Pipeline**

1. HTML → Markdown: `turndown` with custom rules
2. Content aggregation:
   - Frontmatter with source URL
   - Section headers with page titles
3. PDF Generation: `md-to-pdf` with table of contents

4. **Key Optimizations**

- Link deduplication with bloom filter
- Connection reuse with `undici` fetch
- Memory management for large documents
- Parallel processing pipeline:
  ```
  Crawl → Convert → Aggregate (parallel stages)
  ```

4. **Dependencies**

```json
{
  "dependencies": {
    "commander": "CLI parsing",
    "p-queue": "Parallel control",
    "turndown": "HTML→Markdown",
    "md-to-pdf": "PDF generation",
    "cheerio": "HTML processing",
    "undici": "High-performance fetch"
  }
}
```

5. **Validation Plan**

- Test matrix: Static sites, SPAs, paginated content
- Benchmark: 100-page doc under 15s (non-IO bound)
- Failure modes: Redirects, auth walls, robots.txt

6. **Execution Flow**

```
$ doc-export --url https://example.com/docs --output manual.pdf

[1/4] Initializing crawler (10 parallel workers)
[2/4] Found 42 pages in 3.2s
[3/4] Converted 42 pages to Markdown (1.8MB)
[4/4] PDF generated: manual.pdf (82 pages)
Done in 4.9s
```

7. **Error Safeguards**

- Network: Retry with exponential backoff
- Memory: Chunked PDF rendering
- Content: Sanitization before conversion

8. **Scaling Considerations**

- Cluster mode for >1k pages
- Partial export resume capability
- CDN cache integration points

Implementation Time Estimate: 6-8 hours (production-grade)

Would you like me to elaborate on any specific component or provide sample code for critical sections?
