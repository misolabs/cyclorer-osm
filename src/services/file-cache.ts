import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type CacheEnvelope<T> = {
  writtenAt: number;
  expiresAt: number;
  data: T;
};

type FileCacheOptions = {
  cacheDir: string;
  ttlSeconds: number;
  subdir?: string;
};

export class FileCache {
  private readonly cacheDir: string;

  private readonly ttlSeconds: number;

  private readonly subdir: string | null;

  constructor(options: FileCacheOptions) {
    this.cacheDir = resolve(process.cwd(), options.cacheDir);
    this.ttlSeconds = options.ttlSeconds;
    this.subdir = options.subdir?.trim() ? options.subdir.trim() : null;
  }

  private getPath(key: string): string {
    return this.subdir
      ? resolve(this.cacheDir, this.subdir, `${key}.json`)
      : resolve(this.cacheDir, `${key}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const contents = await readFile(this.getPath(key), 'utf-8');
      const parsed = JSON.parse(contents) as CacheEnvelope<T>;
      if (parsed.expiresAt <= Date.now()) {
        return null;
      }
      return parsed.data;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, data: T): Promise<void> {
    await mkdir(this.subdir ? resolve(this.cacheDir, this.subdir) : this.cacheDir, { recursive: true });

    const now = Date.now();
    const envelope: CacheEnvelope<T> = {
      writtenAt: now,
      expiresAt: now + this.ttlSeconds * 1000,
      data,
    };

    await writeFile(this.getPath(key), JSON.stringify(envelope), 'utf-8');
  }
}
