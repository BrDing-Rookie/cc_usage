import process from 'node:process';
import { chromium } from 'playwright';
import { parseCodexUsageHtml } from './providers/codexChatgptUsage';
import { resolveProfilePath } from './profileRegistry';

let raw = '';
process.stdin.setEncoding('utf8');

for await (const chunk of process.stdin) {
  raw += chunk;
}

const job = raw.trim() ? JSON.parse(raw) : {};

async function runCodexUsageJob(payload: {
  runtimeDir: string;
  sourceId: string;
  url?: string;
}) {
  const url = typeof payload.url === 'string' && payload.url.length > 0
    ? payload.url
    : 'https://chatgpt.com/codex/cloud/settings/usage';
  const profilePath = resolveProfilePath(payload.runtimeDir, payload.sourceId);

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: true
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    try {
      await page.waitForSelector('[data-test-id="codex-usage"]', { timeout: 10_000 });
    } catch {
      // Fall back to parsing whatever loaded; selectors may change.
    }

    const html = await page.content();
    return {
      ok: true as const,
      data: parseCodexUsageHtml(html),
      meta: { url }
    };
  } finally {
    await context.close();
  }
}

try {
  if (job.provider === 'codex-chatgpt-usage' && typeof job.html === 'string') {
    console.log(JSON.stringify({ ok: true, data: parseCodexUsageHtml(job.html) }));
  } else if (
    job.provider === 'codex-chatgpt-usage' &&
    typeof job.runtimeDir === 'string' &&
    typeof job.sourceId === 'string'
  ) {
    console.log(JSON.stringify(await runCodexUsageJob(job)));
  } else {
    console.log(
      JSON.stringify({
        ok: false,
        error: 'unsupported_source',
        job
      })
    );
  }
} catch (error) {
  console.log(
    JSON.stringify({
      ok: false,
      error: 'worker_error',
      message: error instanceof Error ? error.message : String(error)
    })
  );
}
