export function parseCodexUsageHtml(html: string): {
  planName: string | null;
  usagePercent: number | null;
  resetAt: string | null;
} {
  const planMatch = html.match(/data-test-id="plan">([^<]+)</);
  const usageMatch = html.match(/data-test-id="usage-percent">(\d+)%</);
  const resetMatch = html.match(/data-test-id="reset-at">Resets ([^<]+)</);

  return {
    planName: planMatch?.[1] ?? null,
    usagePercent: usageMatch ? Number(usageMatch[1]) : null,
    resetAt: resetMatch?.[1] ?? null
  };
}
