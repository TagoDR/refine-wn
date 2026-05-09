import { get, set } from 'idb-keyval';
import defaultConfig from '../config.json';

export interface AppConfig {
  ai: {
    endpoint: string;
    model: string;
    maxContext: number;
    temperature: number;
  };
  bootstrap: {
    inputDir: string;
    settingsFile: string;
    instructionsDir: string;
  };
  refine: {
    inputDir: string;
    outputDir: string;
    workingDir: string;
    settingsFile: string;
    instructionsDir: string;
  };
}

export class ConfigService {
  private static readonly STORAGE_KEY = 'refinewn-config-v1';
  private config: AppConfig = { ...defaultConfig };

  /**
   * Loads config from IndexedDB, falling back to defaults.
   */
  async load(): Promise<AppConfig> {
    const saved = await get<Partial<AppConfig>>(ConfigService.STORAGE_KEY);
    if (saved) {
      this.config = {
        ...defaultConfig,
        ...saved,
        ai: {
          ...defaultConfig.ai,
          ...(saved.ai || {}),
        },
      };
    }
    return this.config;
  }

  /**
   * Saves the current config to IndexedDB.
   */
  async save(newConfig: AppConfig): Promise<void> {
    this.config = newConfig;
    await set(ConfigService.STORAGE_KEY, newConfig);
  }

  /**
   * Returns the current config.
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Resets config to defaults.
   */
  async reset(): Promise<AppConfig> {
    this.config = { ...defaultConfig };
    await this.save(this.config);
    return this.config;
  }
}
