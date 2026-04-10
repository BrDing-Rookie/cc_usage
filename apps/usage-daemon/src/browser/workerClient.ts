import { spawn } from 'node:child_process';

export async function runBrowserJob(job: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const child = spawn('corepack', ['pnpm', '--filter', '@vibe-monitor/browser-worker', 'start'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    const stdout = child.stdout;
    const stdin = child.stdin;

    if (!stdout || !stdin) {
      reject(new Error('browser worker pipes unavailable'));
      return;
    }

    let output = '';

    stdout.on('data', (chunk) => {
      output += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`browser worker exited with ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch (error) {
        reject(error);
      }
    });

    stdin.write(JSON.stringify(job));
    stdin.end();
  });
}
