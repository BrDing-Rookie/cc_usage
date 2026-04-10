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

When started via `corepack pnpm dev:daemon` and `corepack pnpm dev:shell`,
both processes share the repository root `var/` directory through
`VIBE_MONITOR_RUNTIME_DIR=$PWD`.

- SQLite database: `var/usage-monitor.sqlite`
- Materialized state: `var/current-snapshots.json`
- Browser profiles: `var/browser-profiles/<source-id>/`
