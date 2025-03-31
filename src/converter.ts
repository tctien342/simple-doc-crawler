import TurndownService from 'turndown';
import { PageData, CrawlerConfig } from './interfaces.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DocumentConverter {
  private turndownService: TurndownService;

  constructor() {
    // Initialize TurndownService with custom rules
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });

    // Add custom rules for better conversion
    this.addCustomRules();
  }

  /**
   * Add custom rules to improve HTML to Markdown conversion
   */
  private addCustomRules(): void {
    // Improve table handling
    this.turndownService.addRule('tables', {
      filter: ['table'],
      replacement: function (content, node) {
        // Basic table handling - could be enhanced further
        return '\n\n' + content + '\n\n';
      }
    });

    // Better handling of code blocks
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre', 'code'],
      replacement: function (content) {
        return '```\n' + content + '\n```';
      }
    });

    // Ignore style tags and their content
    this.turndownService.remove(['style', 'script']);

    // Ignore inline styles
    this.turndownService.addRule('removeInlineStyles', {
      filter: function (node) {
        return node.nodeName !== 'STYLE' && node.nodeName !== 'SCRIPT' && node.hasAttribute && node.hasAttribute('style');
      },
      replacement: function (content) {
        return content;
      }
    });
  }

  /**
   * Clean HTML before conversion
   */
  private cleanHtml(html: string): string {
    // Simple pre-processing to clean up the HTML
    return html
      // Strip style blocks
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      // Strip script blocks
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }

  /**
   * Convert HTML to Markdown
   */
  public convertToMarkdown(html: string): string {
    const cleanedHtml = this.cleanHtml(html);
    return this.turndownService.turndown(cleanedHtml);
  }

  /**
   * Process a collection of pages into markdown files
   * splitPages options:
   * - 'none': All pages combined into a single document (default)
   * - 'subdirectories': Each page saved as a separate file in a subdirectory
   * - 'flat': Each page saved as a separate file in the output directory with folder name in filename
   */
  public async processPages(pages: PageData[], outputDir: string, splitPages?: 'none' | 'subdirectories' | 'flat'): Promise<string> {
    // Sort pages (could be enhanced with more sophisticated ordering)
    const sortedPages = [...pages].sort((a, b) => a.url.localeCompare(b.url));

    // Handle different page splitting options
    if (splitPages === 'subdirectories' || splitPages === 'flat') {
      console.log(`Saving ${sortedPages.length} pages as separate markdown files...`);

      // Directory setup depends on mode
      let pagesDir = outputDir;
      if (splitPages === 'subdirectories') {
        pagesDir = path.join(outputDir, 'pages');
        await fs.mkdir(pagesDir, { recursive: true });
      }

      // Create an index file with links to all pages
      let indexContent = '---\n';
      indexContent += 'title: Exported Documentation Index\n';
      indexContent += `date: ${new Date().toISOString()}\n`;
      indexContent += `sources: ${pages.length} pages\n`;
      indexContent += '---\n\n';
      indexContent += '# Documentation Index\n\n';

      // Process pages by folder
      const pagesByFolder = this.groupPagesByFolder(sortedPages);

      // Process each folder's pages
      let pageIndex = 0;
      for (const [folderName, folderPages] of Object.entries(pagesByFolder)) {
        const safeFolder = this.sanitizeString(folderName);

        // Process each page within this folder
        for (let i = 0; i < folderPages.length; i++) {
          const page = folderPages[i];
          const title = page.title || `Page ${pageIndex + 1}`;

          // Create a filename based on the mode
          let safeFilename;
          let pageFilePath;

          if (splitPages === 'flat') {
            // For flat mode, include folder name in the filename
            safeFilename = `${safeFolder}_${this.createSafeFilename(page.url, title, i)}`;
            pageFilePath = path.join(outputDir, safeFilename);

            // Add link to index with just the filename
            indexContent += `${pageIndex + 1}. [${title}](${safeFilename})\n`;
          } else {
            // For subdirectories mode
            safeFilename = this.createSafeFilename(page.url, title, i);
            pageFilePath = path.join(pagesDir, safeFilename);

            // Add link to index with the pages/ prefix
            indexContent += `${pageIndex + 1}. [${title}](pages/${safeFilename})\n`;
          }

          // Create individual page content
          let pageContent = '---\n';
          pageContent += `title: ${title}\n`;
          pageContent += `source: ${page.url}\n`;
          pageContent += `folder: ${folderName}\n`;
          pageContent += `date: ${new Date().toISOString()}\n`;
          pageContent += '---\n\n';
          pageContent += `# ${title}\n\n`;
          pageContent += `*Source: [${page.url}](${page.url})*\n\n`;
          pageContent += this.convertToMarkdown(page.content);

          // Save the page file
          await fs.writeFile(pageFilePath, pageContent, 'utf-8');

          pageIndex++;
        }
      }

      // Save the index file
      const indexPath = path.join(outputDir, 'index.md');
      await fs.writeFile(indexPath, indexContent, 'utf-8');

      return indexPath;
    } else {
      // Create markdown content with frontmatter for a single combined file
      let markdownContent = '---\n';
      markdownContent += 'title: Exported Documentation\n';
      markdownContent += `date: ${new Date().toISOString()}\n`;
      markdownContent += `sources: ${pages.length} pages\n`;
      markdownContent += '---\n\n';

      // Generate table of contents
      markdownContent += '# Table of Contents\n\n';
      for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i];
        const title = page.title || `Page ${i + 1}`;
        markdownContent += `${i + 1}. [${title}](#${title.toLowerCase().replace(/[^\w]+/g, '-')})\n`;
      }

      markdownContent += '\n---\n\n';

      // Add each page content
      for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i];
        const title = page.title || `Page ${i + 1}`;

        markdownContent += `# ${title}\n\n`;
        markdownContent += `*Source: [${page.url}](${page.url})*\n\n`;
        markdownContent += this.convertToMarkdown(page.content);
        markdownContent += '\n\n---\n\n';
      }

      // Save the combined markdown file
      const markdownPath = path.join(outputDir, 'document.md');
      await fs.writeFile(markdownPath, markdownContent, 'utf-8');

      return markdownPath;
    }
  }

  /**
   * Create a safe filename from URL and title
   */
  private createSafeFilename(url: string, title: string, index: number): string {
    // Try to extract a meaningful part from the URL if the title is generic
    if (title.startsWith('Page ')) {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(p => p);
        if (pathParts.length > 0) {
          const lastPathPart = pathParts[pathParts.length - 1];
          if (lastPathPart && lastPathPart !== '') {
            // Clean up common file extensions and use as title
            title = lastPathPart.replace(/\.(html|htm|php|aspx?)$/i, '');
          }
        }
      } catch (e) {
        // Fall back to using the index if URL parsing fails
      }
    }

    // Create a safe filename from the title
    let safeFilename = title
      .toLowerCase()
      .replace(/[^\w]+/g, '-') // Replace non-word chars with hyphens
      .replace(/-+/g, '-')     // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, '');  // Remove leading/trailing hyphens

    // If we end up with an empty string, use the index
    if (!safeFilename || safeFilename === '') {
      safeFilename = `page-${index + 1}`;
    }

    // Add md extension
    return `${safeFilename}.md`;
  }

  /**
   * Group pages by their URL domain and path (folder)
   */
  private groupPagesByFolder(pages: PageData[]): Record<string, PageData[]> {
    const result: Record<string, PageData[]> = {};

    for (const page of pages) {
      try {
        const url = new URL(page.url);
        // Use pathname as the folder name, or 'unknown' if it can't be determined
        const folderName = url.pathname.split('/').slice(0, 2).join('_') || 'unknown';

        if (!result[folderName]) {
          result[folderName] = [];
        }

        result[folderName].push(page);
      } catch (e) {
        // If URL parsing fails, put in 'unknown' folder
        if (!result['unknown']) {
          result['unknown'] = [];
        }
        result['unknown'].push(page);
      }
    }

    return result;
  }

  /**
   * Sanitize a string for use in filenames
   */
  private sanitizeString(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^\w.]+/g, '_') // Replace non-word chars with underscores
      .replace(/^_|_$/g, '')    // Remove leading/trailing underscores
      .replace(/_+/g, '_');     // Replace multiple underscores with single underscore
  }

  /**
   * For now, just save the markdown file and notify the user
   * In a production environment, this would be replaced with a proper PDF generation
   */
  public async generatePDF(markdownPath: string, outputDir: string): Promise<string> {
    // For now, just return the markdown path
    console.log('PDF generation is currently disabled. Using markdown output instead.');
    console.log(`You can convert "${markdownPath}" to PDF using an external tool.`);

    return markdownPath;
  }
}