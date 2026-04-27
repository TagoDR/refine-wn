import type { Chapter, EpubMetadata } from './epub-service';

export class EpubWorkerClient {
	private worker: Worker;
	private nextId = 0;
	private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

	constructor() {
		this.worker = new Worker(new URL('../workers/epub-worker.ts', import.meta.url), {
			type: 'module',
		});

		this.worker.onmessage = (e) => {
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
		return this.send('load', data);
	}

	async save(chapters: Chapter[]): Promise<Blob> {
		return this.send('save', chapters);
	}

	private send(type: string, payload: any): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = this.nextId++;
			this.pendingRequests.set(id, { resolve, reject });
			this.worker.postMessage({ type, payload, id });
		});
	}

	terminate() {
		this.worker.terminate();
	}
}
