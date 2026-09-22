import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export class JsonFileStore<T> {
  constructor(private readonly filePath: string) {}

  async load(fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(this.filePath, 'utf8')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
      throw error;
    }
  }

  async save(value: T): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = join(dirname(this.filePath), `.${Date.now()}-${process.pid}.tmp`);
    await writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}
