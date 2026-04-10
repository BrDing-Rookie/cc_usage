import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function resolveRuntimeDir(cwd: string = process.cwd()): string {
  const dir = resolve(cwd, 'var');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function resolveDataFile(cwd: string = process.cwd()): string {
  return join(resolveRuntimeDir(cwd), 'usage-monitor.sqlite');
}
