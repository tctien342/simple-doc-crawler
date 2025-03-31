# Doc Crawler

A Node.js/TypeScript CLI tool for crawling documentation websites and exporting them to Markdown, built with BunJS.

## Features

- Parallel web crawling with configurable concurrency
- Domain-specific crawling option
- Automatic conversion from HTML to Markdown
- Generates a well-formatted document with table of contents
- Handles timeouts and crawling limits for stability
- Built with BunJS for optimal performance

## Installation

### From npm
```bash
# Install globally
npm install -g @saintno/doc-export

# Or with yarn
yarn global add @saintno/doc-export

# Or with pnpm
pnpm add -g @saintno/doc-export
```

### From source

#### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)

#### Setup

1. Clone this repository
2. Install dependencies:

```bash
bun install
```

3. Build the project:

```bash
bun run build
```

## Usage

Basic usage:

```bash
# If installed from npm:
doc-export --url https://example.com/docs --output ./output

# If running from source:
bun run start --url https://example.com/docs --output ./output
```

### Command Line Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| --url | -u | URL to start crawling from (required) | - |
| --output | -o | Output directory for the Markdown (required) | - |
| --concurrency | -c | Maximum number of concurrent requests | 5 |
| --same-domain | -s | Only crawl pages within the same domain | true |
| --max-urls | | Maximum URLs to crawl per domain | 200 |
| --request-timeout | | Request timeout in milliseconds | 5000 |
| --max-runtime | | Maximum crawler run time in milliseconds | 30000 |
| --allowed-prefixes | | Comma-separated list of URL prefixes to crawl | - |
| --split-pages | | How to split pages: "none", "subdirectories", or "flat" | none |

## Example

```bash
doc-export --url https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide --output ./javascript-guide --concurrency 3 --max-urls 300 --request-timeout 10000 --max-runtime 60000
```

This example will:
- Start crawling from the MDN JavaScript Guide
- Save files in the ./javascript-guide directory
- Use 3 concurrent requests
- Crawl up to 300 URLs (default is 200)
- Set request timeout to 10 seconds (default is 5 seconds)
- Run the crawler for a maximum of 60 seconds (default is 30 seconds)

### URL Prefix Filtering Example

To only crawl URLs with specific prefixes:

```bash
doc-export --url https://developer.mozilla.org/en-US/docs/Web/JavaScript --output ./javascript-guide --allowed-prefixes https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide,https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference
```

This example will:
- Start crawling from the MDN JavaScript documentation
- Only process URLs that start with the specified prefixes (Guide and Reference sections)
- Ignore other URLs even if they are within the same domain

## How It Works

1. **Crawling Phase**: The tool starts from the provided URL and crawls all linked pages (respecting domain restrictions and URL prefix filters if specified)
2. **Processing Phase**: Each HTML page is converted to Markdown using Turndown
3. **Aggregation Phase**: All Markdown content is combined into a single document with a table of contents

### Filtering Options

The crawler supports two types of URL filtering:

1. **Domain Filtering** (`--same-domain`): When enabled, only URLs from the same domain as the starting URL will be crawled.
2. **Prefix Filtering** (`--allowed-prefixes`): When specified, only URLs that start with one of the provided prefixes will be crawled. This is useful for limiting the crawl to specific sections of a website.

These filters can be combined to precisely target the content you want to extract.

## Implementation Details

- Uses bloom filters for efficient link deduplication
- Implements connection reuse with undici fetch
- Handles memory management for large documents
- Processes pages in parallel for maximum efficiency
- Implements timeouts and limits to prevent crawling issues

## PDF Support

The current implementation outputs Markdown (.md) files. To convert to PDF, you can use a third-party tool such as:

- [Pandoc](https://pandoc.org/): `pandoc -f markdown -t pdf -o output.pdf document.md`
- [mdpdf](https://github.com/BlueHatbRit/mdpdf): `mdpdf document.md`
- Or any online Markdown to PDF converter

## License

MIT