import JSZip from 'jszip';
import { DOMParser } from 'linkedom';

export interface Chapter {
  id: string;
  title: string;
  href: string;
  content: string;
  source?: string;
  originalContent?: string;
}

export interface ImageAsset {
  href: string;
  content: Uint8Array;
  mediaType: string;
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
   * Extracts all binary assets (images) from the EPUB
   */
  async getAssets(): Promise<ImageAsset[]> {
    if (!this.zip) throw new Error('EPUB not loaded');
    const opfDoc = await this.readXmlFile(this.opfPath);
    const assets: ImageAsset[] = [];

    const items = Array.from(opfDoc.querySelectorAll('manifest > item'));
    for (const item of items) {
      const href = item.getAttribute('href');
      const mediaType = item.getAttribute('media-type');

      if (href && mediaType?.startsWith('image/')) {
        const fullPath = this.resolvePath(href);
        const content = await this.zip.file(fullPath)?.async('uint8array');
        if (content) {
          assets.push({ href, content, mediaType });
        }
      }
    }
    return assets;
  }

  private resolvePath(href: string): string {
    // Basic path resolution relative to rootDir
    if (href.startsWith('/')) return href.substring(1);
    return this.rootDir + href;
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
   * Saves changes back to an EPUB Blob, removing any chapters not in the provided list.
   */
  async save(updatedChapters: Chapter[]): Promise<Blob> {
    if (!this.zip) throw new Error('EPUB not loaded');

    const newZip = new JSZip();
    const updatedChapterIds = new Set(updatedChapters.map(c => c.id));
    const updatedChapterHrefs = new Set(updatedChapters.map(c => c.href));

    // 1. Update the .opf file (Manifest & Spine)
    const opfDoc = await this.readXmlFile(this.opfPath);

    // Filter/Update Manifest
    const manifest = opfDoc.querySelector('manifest');
    if (manifest) {
      // First, remove ones not in our updated list
      const items = Array.from(manifest.querySelectorAll('item'));
      for (const item of items) {
        const id = item.getAttribute('id');
        const mediaType = item.getAttribute('media-type');
        if (id && mediaType === 'application/xhtml+xml' && !updatedChapterIds.has(id)) {
          item.remove();
        }
      }

      // Then, add missing ones
      for (const chapter of updatedChapters) {
        if (!manifest.querySelector(`item[id="${chapter.id}"]`)) {
          const item = opfDoc.createElement('item');
          item.setAttribute('id', chapter.id);
          item.setAttribute('href', chapter.href);
          item.setAttribute('media-type', 'application/xhtml+xml');
          manifest.appendChild(item);
        }
      }
    }

    // Filter/Update Spine
    const spine = opfDoc.querySelector('spine');
    if (spine) {
      // Clear spine and rebuild to ensure order matches our state
      const itemrefs = Array.from(spine.querySelectorAll('itemref'));
      for (const itemref of itemrefs) {
        itemref.remove();
      }

      for (const chapter of updatedChapters) {
        const itemref = opfDoc.createElement('itemref');
        itemref.setAttribute('idref', chapter.id);
        spine.appendChild(itemref);
      }
    }

    const updatedOpfContent = `<?xml version="1.0" encoding="UTF-8"?>${opfDoc.documentElement.outerHTML}`;

    // 2. Build the new ZIP
    for (const [path, file] of Object.entries(this.zip.files)) {
      if (path === this.opfPath) {
        newZip.file(path, updatedOpfContent);
        continue;
      }

      // Check if this path is a chapter file
      const relativePath = path.startsWith(this.rootDir)
        ? path.substring(this.rootDir.length)
        : path;

      // If it's a chapter file (XHTML) and not in our href list, skip it
      if (path.startsWith(this.rootDir) && (path.endsWith('.xhtml') || path.endsWith('.html'))) {
        if (!updatedChapterHrefs.has(relativePath)) {
          continue; // Skip trashed chapter file
        }
      }

      const content = await file.async('uint8array');
      newZip.file(path, content);
    }

    // 3. Update the content for the remaining chapters
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
    // Linkedom types aren't perfectly aligned with native Document, so we cast to unknown then Document
    return parser.parseFromString(content, 'text/xml') as unknown as Document;
  }
}
