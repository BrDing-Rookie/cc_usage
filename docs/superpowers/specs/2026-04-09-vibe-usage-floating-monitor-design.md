# Vibe Usage Floating Monitor Design

## Overview

This design defines a macOS floating monitor that stays on the desktop as a low-presence, semi-transparent utility for tracking usage across multiple vibe coding plan sources. The monitor is intentionally not a status line clone and not a reuse of existing Claude HUD logic. It is a separate desktop product with its own collectors, state model, refresh orchestration, alerting, and UI behavior.

The product goal is to give a reliable, glanceable answer to:

- Which sources are healthy right now?
- Which plans are approaching quota limits?
- When does each quota reset?
- Which sources failed to refresh and may be stale?

The first version targets a local-only macOS app with a floating panel, a background usage daemon, source-specific adapters, normalized local storage, and optional browser automation for sources that have no stable API, CLI, or local state path.

## Product Intent

The monitor should feel like a calm desktop object during normal work and a stronger signal only when attention is needed.

Normal state:

- Semi-transparent and always visible
- Low visual weight
- Shows only grouped summary and refresh health
- Does not steal focus

Interactive state:

- Triggered by hover or a keyboard shortcut
- Becomes more opaque and readable
- Expands to show per-source detail
- Allows interaction without turning into a large dashboard

Alert state:

- Stronger border, color, and ordering emphasis
- No modal popups
- No focus stealing
- Distinguishes low quota from stale refreshes and auth failures

## Confirmed Scope Decisions

The following decisions are fixed for this design:

- Form factor: independent floating panel on macOS desktop
- UI behavior: balanced mode, low presence by default, stronger only on hover/shortcut/alert
- Data acquisition: included in scope as part of the product
- Metrics required for each source when available:
  - usage percentage
  - absolute used and total quota
  - reset time
  - alert state
  - refresh health
  - subscription or plan name
- Collection strategy: use the most stable source available in this order
  - official API
  - official CLI or local state
  - custom endpoint adapter
  - browser automation fallback
- Browser automation policy: allowed only when the source has no stable API, CLI, config, or readable local login state
- Data modeling: official Claude Code, Claude Web, Claude API, each custom `base_url`, Codex official, and future sources are all independent source entries
- Refresh interval: default 5 minutes
- Interaction model: semi-transparent always-on floating panel that becomes stronger and interactive on hover or keyboard shortcut
- Missing absolute quota policy: strict mode; if exact used and total values are not available, the UI must not estimate them

## Non-Goals

These are explicitly out of scope for the initial design:

- Reusing `claude-hud` or any existing status line implementation as the app core
- Treating status line JSON as the main product data model
- Cross-device sync
- Server-side cloud sync
- Mobile clients
- Trend-heavy analytics UI in the first version
- Consolidating distinct sources into a single inferred quota pool

## High-Level Architecture

The system is split into three runtime layers plus shared storage.

### 1. Floating Shell

The floating shell is the macOS presentation layer.

Responsibilities:

- Render the floating panel
- Manage transparency, blur, hover transitions, and expand/collapse behavior
- Support drag position persistence
- Support keyboard shortcut reveal
- Support click-through behavior in the calm state
- Read normalized snapshots and alert state from local storage

The floating shell must not directly call remote APIs, parse credentials, or own browser sessions.

### 2. Usage Daemon

The usage daemon is the long-running local background process.

Responsibilities:

- Maintain the refresh schedule
- Run source adapters with bounded concurrency
- Normalize raw source data into a shared snapshot shape
- Persist latest snapshots and refresh history
- Classify errors and emit alert state
- Preserve last known good data when refresh fails

The usage daemon is the system coordinator. It is the only component that understands the full refresh lifecycle across all sources.

### 3. Browser Worker

The browser worker is a separate process used only for browser-backed sources.

Responsibilities:

- Maintain isolated browser profiles
- Perform headless or background browser automation
- Persist cookies, sessions, and browser-local state per source instance
- Extract structured quota data from pages that have no stable API path

The browser worker is isolated from the main daemon so page crashes, hangs, or anti-bot changes do not destabilize the rest of the system.

### 4. Shared Local Storage

Shared storage consists of:

- SQLite snapshot store for normalized source state
- Keychain-backed secret storage and local encrypted metadata for credentials
- Per-source browser profiles for browser automation sources

This separation is deliberate:

- snapshots are display state
- credentials are secrets
- browser profiles are automation session state

They must not be mixed.

## Source Model

The product should not flatten everything into a vague idea of “platform.” A more reliable model is:

- vendor family
- source
- source instance

### Vendor Family

Examples:

- OpenAI
- Anthropic

### Source

Examples:

- `codex-official`
- `claude-code-official`
- `claude-web`
- `claude-api`
- `claude-code-custom-<base_url>`

### Source Instance

A source instance is the specific monitored account, workspace, or subscription entry represented in the UI and storage.

This model allows:

- one official source and multiple custom `base_url` sources under the same vendor group
- independent auth and failure handling
- independent refresh and alert histories

## Source Categories

Each adapter must declare one of four kinds:

- `official_api`
- `official_cli_or_local_state`
- `custom_endpoint`
- `browser_automation`

These are the only categories needed for the first version.

This categorization is important because it drives:

- auth strategy
- refresh timeout expectations
- staleness thresholds
- logging and observability
- UI messaging when errors occur

## Adapter Contract

Every adapter must implement the same logical contract:

1. Acquire or reuse valid authentication state
2. Fetch raw usage state from the source
3. Normalize raw data into the shared snapshot schema
4. Declare field capabilities
5. Return structured success or structured failure

Adapters must not directly write UI output. They emit normalized state only.

### Shared Snapshot Schema

Every source snapshot should include the following fields:

- `source_id`
- `vendor_family`
- `source_kind`
- `account_label`
- `plan_name`
- `usage_percent`
- `used_amount`
- `total_amount`
- `amount_unit`
- `reset_at`
- `refresh_status`
- `last_success_at`
- `last_error`
- `capabilities`

### Capabilities

`capabilities` declares what a source can truthfully provide:

- `percent`
- `absolute_amount`
- `reset_time`
- `plan_name`
- `health_signal`

This prevents the UI from confusing “missing field” with “refresh failure.”

### Strict Missing-Field Rule

If a source cannot provide exact `used_amount` and `total_amount`, the system must not estimate them.

Allowed:

- show percent only
- show reset time only
- show explicit text such as `absolute quota unavailable`

Not allowed:

- historical estimation
- inferred totals from percentage alone
- presentation-layer guessing

## Refresh Pipeline

All sources follow the same refresh pipeline:

`source adapter -> raw fetch -> normalize -> validate -> snapshot store -> alert engine -> floating UI`

### Refresh Scheduling

Default scheduling policy:

- each source refreshes every 5 minutes
- the daemon checks whether each source is due
- refreshes execute with bounded concurrency
- slow or failing sources must not block fast sources

### Success Behavior

On success:

- write the new normalized snapshot
- update `last_success_at`
- clear transient refresh errors
- recompute derived alert state

### Failure Behavior

On failure:

- preserve the last successful snapshot as display state
- update `refresh_status`
- write a structured `last_error`
- record the failure timestamp
- upgrade to stale state only after the configured staleness threshold is crossed

This ensures the floating panel stays useful even when a source temporarily fails.

## Credential and Session Strategy

Credential handling must be source-aware, not global.

Each source declares its own auth strategy. The priority order is:

1. existing environment variables
2. existing local config files
3. existing local logged-in state
4. tool-managed secure local credentials
5. browser session state for automation-backed sources

### Existing State First

The system should prefer reusing what already exists on the machine.

Examples:

- environment variables
- official CLI config
- local session files
- macOS Keychain entries created by existing tools

This minimizes login churn and avoids duplicate secrets.

### Secure Storage

When the tool needs to store its own secrets, use:

- macOS Keychain for secrets
- local encrypted metadata only when Keychain is not sufficient for non-secret supporting data

Secrets must not be stored in the SQLite snapshot store.

### Browser Automation Sessions

Browser-backed sources may keep session state in dedicated local browser profiles.

Rules:

- browser automation is opt-in per source path, not globally always-on
- each browser-backed source instance gets its own profile
- profiles must not be shared across unrelated sources
- cookies and local browser state must be isolated by source instance

This reduces cross-source contamination and makes failures diagnosable.

## Alert Model

The alert engine should classify issues into four distinct states:

- `quota_low`
- `refresh_stale`
- `auth_invalid`
- `source_broken`

### quota_low

Meaning:

- the source is healthy
- current data is trustworthy
- quota is nearing a threshold

UI emphasis:

- highlight usage percentage
- highlight reset time

### refresh_stale

Meaning:

- the source has old but previously valid data
- the system has not refreshed recently enough

UI emphasis:

- highlight `last_success_at`
- indicate the panel is showing stale data

### auth_invalid

Meaning:

- credentials or logged-in session are no longer valid

UI emphasis:

- indicate re-authentication is required
- do not pretend the old data is still fresh

### source_broken

Meaning:

- parser failure
- DOM structure changed
- unsupported response shape
- custom endpoint behavior changed

UI emphasis:

- identify that the adapter or parser path broke
- separate it visually from ordinary auth or quota issues

This split is critical because “low quota” and “collector broken” require completely different responses from the user.

## UI Information Architecture

The floating panel has three UI states.

### Calm State

Visible by default.

Shows:

- global health label
- grouped vendor summary
- recent refresh status

Does not show:

- full per-source breakdown
- dense numbers for every entry

Behavior:

- semi-transparent
- low prominence
- click-through or low-friction interaction behavior

### Expanded State

Triggered by hover or keyboard shortcut.

Shows per-source entries with:

- source label
- usage percentage
- used and total quota when available
- reset time
- plan name
- refresh health
- explicit missing-field labels when a capability is absent

The expanded state is the default place for detail, not the calm state.

### Alert State

Triggered when any source crosses configured thresholds or health rules.

Behavior:

- stronger opacity
- stronger border and title emphasis
- riskier sources float higher in ordering
- still non-modal
- still non-focus-stealing

The panel should feel more urgent without behaving like a notification dialog.

## UX Rules

The following interaction rules are fixed:

- always visible floating panel
- semi-transparent by default
- becomes more opaque and interactive on hover
- keyboard shortcut reveals or enhances interaction
- does not behave like a modal or tray popup
- does not expand into a full dashboard in the first version

## Recommended Technology Direction

The recommended technical approach is:

- macOS native shell for window behavior
- web-based renderer inside that shell for UI flexibility
- local background daemon for orchestration
- SQLite for snapshot storage
- Keychain for secrets
- dedicated browser worker for browser automation sources

This is preferred because:

- macOS window behavior needs native reliability
- the UI is still easier to iterate in web technology
- source collection and rendering should not share failure domains

## Initial Source Coverage

The first version should start small and prove the core architecture.

### MVP Source Set

- `claude-code-official`
- one `claude-code-custom-<base_url>` instance
- `codex-official`

These three sources are enough to validate:

- independent source modeling
- official and non-official coexistence
- strict capability handling
- daemon and floating shell separation

### Deferred Source Set

The following can follow after the architecture is validated:

- `claude-web`
- `claude-api`
- multiple custom `base_url` instances
- additional vendor-specific monitors

## Error Handling

Error handling should be normalized, not improvised per source.

### Required Error Properties

Every refresh failure should carry:

- machine-readable error category
- human-readable short message
- failure timestamp
- whether old data is still displayable

### Logging Rules

Logs must avoid leaking:

- raw access tokens
- cookie headers
- full credential objects
- page HTML dumps containing user data
- unredacted query strings with secrets

Logs may include:

- source id
- adapter kind
- short error code
- refresh duration
- retry count
- capability failures

## Testing Strategy

Testing must be part of the design, not deferred.

### Adapter Unit Tests

For each adapter:

- test normalization from representative raw input
- test missing-field behavior
- test auth-invalid behavior
- test parser failure behavior

### Contract Tests

Test the shared snapshot contract:

- percent-only source
- full absolute quota source
- reset-only source
- auth-invalid source
- stale source

### Browser Automation Tests

For browser-backed sources:

- replay or fixture-based DOM parsing tests
- error classification when expected selectors disappear
- session reuse verification

### Daemon Integration Tests

Test:

- parallel refresh execution
- partial success, partial failure
- stale escalation
- last-good snapshot preservation

### UI State Tests

Verify:

- calm state rendering
- expanded state rendering
- alert state rendering
- explicit display of missing absolute quota

## MVP Definition

The MVP should include:

- floating shell with calm and expanded states
- local usage daemon
- normalized SQLite snapshot store
- strict capability-aware rendering
- alert classification for:
  - `quota_low`
  - `refresh_stale`
  - `auth_invalid`
- default 5-minute refresh
- three initial source adapters:
  - `claude-code-official`
  - one custom `claude-code-custom-<base_url>`
  - `codex-official`

The MVP should not include:

- full multi-`base_url` management UI
- trend charts
- menu bar companion
- cloud sync
- broad browser automation coverage for every possible source

## Why This Design

This design is optimized for long-lived reliability rather than short-lived convenience.

It avoids the main failure modes of status-line-style tooling:

- coupling collection and display
- assuming one vendor-specific auth model
- treating missing data as inferable
- letting one broken source degrade the whole interface

It also preserves room for future growth without forcing early complexity into the UI.

The floating panel stays small, the daemon handles coordination, adapters stay isolated, and strict field capability rules keep the displayed usage state honest.
