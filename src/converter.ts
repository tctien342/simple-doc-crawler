import TurndownService from 'turndown';
import { PageData } from './interfaces.js';
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
      replacement: function(content, node) {
        // Basic table handling - could be enhanced further
        return '\n\n' + content + '\n\n';
      }
    });
    
    // Better handling of code blocks
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre', 'code'],
      replacement: function(content) {
        return '```\n' + content + '\n```';
      }
    });
    
    // Ignore style tags and their content
    this.turndownService.remove(['style', 'script']);
    
    // Ignore inline styles
    this.turndownService.addRule('removeInlineStyles', {
      filter: function(node) {
        return node.nodeName !== 'STYLE' && node.nodeName !== 'SCRIPT' && node.hasAttribute && node.hasAttribute('style');
      },
      replacement: function(content) {
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
   * Process a collection of pages into a single document
   */
  public async processPages(pages: PageData[], outputDir: string): Promise<string> {
    // Sort pages (could be enhanced with more sophisticated ordering)
    const sortedPages = [...pages].sort((a, b) => a.url.localeCompare(b.url));
    
    // Create markdown content with frontmatter
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