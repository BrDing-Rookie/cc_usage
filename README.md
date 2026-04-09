# Vibe Usage Monitor

## Development

Run the renderer:

```bash
corepack pnpm dev:desktop
```

Run the floating shell:

```bash
corepack pnpm dev:shell
```

Run the daemon:

```bash
corepack pnpm dev:daemon
```

Run all tests:

```bash
corepack pnpm test
```

## Runtime Output

Paths are relative to the daemon working directory. When started via
`corepack pnpm dev:daemon`, they are created under `apps/usage-daemon/var/`.

- SQLite database: `var/usage-monitor.sqlite`
- Materialized state: `var/current-snapshots.json`
- Browser profiles: `var/browser-profiles/<source-id>/`
