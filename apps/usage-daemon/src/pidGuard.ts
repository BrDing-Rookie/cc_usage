import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

function pidFilePath(runtimeDir: string): string {
  return join(runtimeDir, 'var', '.daemon.pid');
}

function readPid(path: string): number | null {
  try {
    const pid = parseInt(readFileSync(path, 'utf8').trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquirePidGuard(runtimeDir: string): () => void {
  const path = pidFilePath(runtimeDir);
  mkdirSync(join(runtimeDir, 'var'), { recursive: true });

  const existing = readPid(path);
  if (existing !== null && existing !== process.pid && isAlive(existing)) {
    try {
      process.kill(existing, 'SIGTERM');
    } catch { /* already gone */ }
  }

  writeFileSync(path, String(process.pid), 'utf8');

  const cleanup = () => {
    try {
      if (readPid(path) === process.pid) {
        unlinkSync(path);
      }
    } catch { /* best effort */ }
  };

  process.on('exit', cleanup);
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  return cleanup;
}
