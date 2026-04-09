import process from 'node:process';
import { parseCodexUsageHtml } from './providers/codexChatgptUsage';

let raw = '';
process.stdin.setEncoding('utf8');

for await (const chunk of process.stdin) {
  raw += chunk;
}

const job = raw.trim() ? JSON.parse(raw) : {};

if (job.provider === 'codex-chatgpt-usage' && typeof job.html === 'string') {
  console.log(JSON.stringify({ ok: true, data: parseCodexUsageHtml(job.html) }));
} else {
  console.log(
    JSON.stringify({
      ok: false,
      error: 'unsupported_source',
      job
    })
  );
}
