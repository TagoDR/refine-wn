import { EpubService } from '../services/epub-service';

const epubService = new EpubService();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'load': {
        await epubService.load(payload);
        const metadata = await epubService.getMetadata();
        const chapters = await epubService.getChapters();
        const assets = await epubService.getAssets();
        self.postMessage({ id, payload: { metadata, chapters, assets } });
        break;
      }
      case 'save': {
        const blob = await epubService.save(payload);
        self.postMessage({ id, payload: blob });
        break;
      }
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message });
  }
};
