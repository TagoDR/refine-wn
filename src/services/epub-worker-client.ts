import type { Chapter, EpubMetadata } from './epub-service';

export interface WorkerRequest {
  id: number;
  type: 'load' | 'save';
  payload: unknown;
}

export interface WorkerResponse {
  id: number;
  payload?: unknown;
  error?: string;
}

export class EpubWorkerClient {
  private worker: Worker;
  private nextId = 0;
  private pendingRequests = new Map<
    number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(new URL('../workers/epub-worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, payload, error } = e.data;
      const request = this.pendingRequests.get(id);
      if (request) {
        this.pendingRequests.delete(id);
        if (error) {
          request.reject(new Error(error));
        } else {
          request.resolve(payload);
        }
      }
    };
  }

  async load(data: Blob | ArrayBuffer): Promise<{ metadata: EpubMetadata; chapters: Chapter[] }> {
    return this.send<{ metadata: EpubMetadata; chapters: Chapter[] }>('load', data);
  }

  async save(chapters: Chapter[]): Promise<Blob> {
    return this.send<Blob>('save', chapters);
  }

  private send<T>(type: WorkerRequest['type'], payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pendingRequests.set(id, {
        resolve: resolve as (val: unknown) => void,
        reject,
      });
      const request: WorkerRequest = { type, payload, id };
      this.worker.postMessage(request);
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}
