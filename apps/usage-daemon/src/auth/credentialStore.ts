export function resolveCredentialValue(
  key: string,
  env: Record<string, string | undefined>,
  config: Record<string, string | undefined>,
  localState: Record<string, string | undefined>
): string | null {
  return env[key] ?? config[key] ?? localState[key] ?? null;
}

export function resolveBrowserProfileDir(runtimeDir: string, sourceId: string): string {
  return `${runtimeDir}/browser-profiles/${sourceId}`;
}
