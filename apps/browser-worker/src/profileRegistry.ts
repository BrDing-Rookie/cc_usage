export function resolveProfilePath(runtimeDir: string, sourceId: string): string {
  return `${runtimeDir}/browser-profiles/${sourceId}`;
}
