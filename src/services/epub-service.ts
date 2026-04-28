import JSZip from 'jszip';
import { DOMParser } from 'linkedom';

export interface Chapter {
  id: string;
  title: string;
  href: string;
  content: string;
  originalContent?: string;
}

export interface EpubMetadata {
  title: string;
  creator?: string;
  language?: string;
}

export class EpubService {
  private zip: JSZip | null = null;
  private rootDir = '';
  private opfPath = '';

  /**
   * Loads an EPUB file from a Blob or ArrayBuffer
   */
  async load(data: Blob | ArrayBuffer): Promise<void> {
    this.zip = await JSZip.loadAsync(data);
    this.opfPath = await this.findOpfPath();
    this.rootDir = this.opfPath.substring(0, this.opfPath.lastIndexOf('/') + 1);
  }

  /**
   * Parses META-INF/container.xml to find the root .opf file
   */
  private async findOpfPath(): Promise<string> {
    if (!this.zip) throw new Error('EPUB not loaded');

    const containerXml = await this.zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) throw new Error('META-INF/container.xml not found');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(containerXml, 'text/xml');
    const rootfile = xmlDoc.querySelector('rootfile');
    const fullPath = rootfile?.getAttribute('full-path');

    if (!fullPath) throw new Error('Root .opf path not found in container.xml');
    return fullPath;
  }

  /**
   * Extracts Metadata from the .opf file
   */
  async getMetadata(): Promise<EpubMetadata> {
    const opfDoc = await this.readXmlFile(this.opfPath);
    const metadata = opfDoc.querySelector('metadata');

    return {
      title: metadata?.querySelector('title')?.textContent?.trim() || 'Unknown Title',
      creator: metadata?.querySelector('creator')?.textContent?.trim() || 'Unknown Creator',
      language: metadata?.querySelector('language')?.textContent?.trim() || 'en',
    };
  }

  /**
   * Extracts Chapter list (TOC) and maps to XHTML files
   */
  async getChapters(): Promise<Chapter[]> {
    const opfDoc = await this.readXmlFile(this.opfPath);

    // 1. Get manifest items
    const manifestItems = new Map<string, string>();
    for (const item of Array.from(opfDoc.querySelectorAll('manifest > item'))) {
      const id = (item as Element).getAttribute('id');
      const href = (item as Element).getAttribute('href');
      if (id && href) {
        manifestItems.set(id, href);
      }
    }

    // 2. Get spine items (order of chapters)
    const spineItemIds: string[] = [];
    for (const itemref of Array.from(opfDoc.querySelectorAll('spine > itemref'))) {
      const idref = (itemref as Element).getAttribute('idref');
      if (idref) {
        spineItemIds.push(idref);
      }
    }

    // 3. Map spine to chapters
    const chapters: Chapter[] = [];
    for (const id of spineItemIds) {
      const href = manifestItems.get(id);
      if (href) {
        const fullPath = this.rootDir + href;
        const content = await this.zip?.file(fullPath)?.async('string');
        if (content) {
          chapters.push({
            id,
            href,
            title: id, // Placeholder title, could be refined by parsing TOC
            content,
            originalContent: content,
          });
        }
      }
    }

    return chapters;
  }

  /**
   * Saves changes back to an EPUB Blob
   */
  async save(updatedChapters: Chapter[]): Promise<Blob> {
    if (!this.zip) throw new Error('EPUB not loaded');

    const newZip = new JSZip();

    // Copy all existing files
    for (const [path, file] of Object.entries(this.zip.files)) {
      const content = await file.async('uint8array');
      newZip.file(path, content);
    }

    // Update modified chapters
    for (const chapter of updatedChapters) {
      const fullPath = this.rootDir + chapter.href;
      newZip.file(fullPath, chapter.content);
    }

    return await newZip.generateAsync({
      type: 'blob',
      mimeType: 'application/epub+zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
  }

  private async readXmlFile(path: string): Promise<Document> {
    if (!this.zip) throw new Error('EPUB not loaded');
    const content = await this.zip.file(path)?.async('string');
    if (!content) throw new Error(`File not found: ${path}`);

    const parser = new DOMParser();
    return parser.parseFromString(content, 'text/xml') as unknown as Document;
  }
}
