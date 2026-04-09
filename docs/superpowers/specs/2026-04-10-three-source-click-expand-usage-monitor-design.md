# Three-Source Click-Expand Usage Monitor Design

## Overview

This design revises the floating monitor into a fixed three-source product with a reference-driven visual layout and a click-to-expand interaction.

The monitor tracks exactly three sources:

- `claude-code-official`
- `codex-official`
- `newapi`

The user-facing presentation names are:

- `Claude Code`
- `OpenAI Codex`
- `NewAPI`

The product goal is no longer a generic source list. It is a compact usage strip that expands into a designed summary panel focused on these three sources only.

## Product Intent

The UI should match the reference behavior:

- a compact summary strip always visible at the top
- expansion triggered by click, not hover
- an expanded panel rendered beneath the strip
- a fixed, editorial layout rather than a generic dashboard grid

The compact strip should be glanceable in the idle state. The expanded panel should feel like a focused status console for the current work session.

## Confirmed Interaction Model

The interaction model is fixed as follows:

- The compact strip is always visible.
- The strip contains exactly three compact source summaries.
- Clicking the strip expands the detailed panel below it.
- Clicking the close button in the expanded header collapses the panel.
- Clicking the strip again collapses the panel.
- Expansion is not hover-driven.
- The expanded panel is rendered in place below the strip, matching the reference composition.

## Confirmed Visual Direction

The visual direction is fixed as follows:

- A macOS-style floating glass panel over a soft desktop-style background
- A compact top strip with three equal source tiles
- A larger main panel beneath with a title row, controls, and three stacked source cards
- Higher information density than the current placeholder renderer
- Distinct source colors:
  - green-cyan emphasis for `Claude Code`
  - blue emphasis for `OpenAI Codex`
  - purple emphasis for `NewAPI`

The top-right time controls should visually match the reference, with `Last 5 hours` as the active real view. `This week` remains visible in this iteration as a non-active visual control and does not require real weekly aggregation logic.

## Source Scope

Only three sources are in scope for this design:

### 1. Claude Code Official

- Source id: `claude-code-official`
- Source kind: `official_api`
- Label in UI: `Claude Code`
- Primary detail model: percentage-based usage with current windows

### 2. Codex Official

- Source id: `codex-official`
- Source kind: `browser_automation`
- Label in UI: `OpenAI Codex`
- Primary detail model: percentage-based usage with currently available official state

### 3. NewAPI

- Source id: `newapi`
- Source kind: `custom_endpoint`
- Label in UI: `NewAPI`
- Primary detail model: USD quota and usage

Any existing generic or placeholder source such as `micc-api` is out of scope and should be removed from the active adapter set.

## NewAPI Integration Contract

`NewAPI` uses the environment variables:

- `MININGLAMP_BASE_URL`
- `MININGLAMP_API_KEY`

The base URL must be normalized before request construction by removing trailing `/` characters. This is required because a trailing slash currently produces `//dashboard/...` requests that return HTML instead of JSON.

The integration uses exactly two endpoints:

- `GET {normalizedBaseUrl}/dashboard/billing/subscription`
- `GET {normalizedBaseUrl}/dashboard/billing/usage`

Both requests use:

- `Authorization: Bearer {MININGLAMP_API_KEY}`

### NewAPI Response Mapping

The mapping follows the existing local `~/get_usage.sh` behavior:

- `subscription.hard_limit_usd` is the total quota
- `usage.total_usage / 100` is the used amount in USD
- `remaining = total - used`
- `usagePercent = used / total * 100` when total is greater than zero

The UI for `NewAPI` should render dollar values rather than integer request counts.

## Data Model Changes

The current materialized state only exposes current snapshots. The expanded design needs lightweight historical series for chart rendering.

The materialized output should therefore expand from:

- current generated timestamp
- current sources

to:

- current generated timestamp
- current sources
- recent per-source history for the active window

The first supported history window is `last_5_hours`.

History should be derived from local SQLite `refresh_history`, not from a new remote analytics service.

### History Shape

For each source, the renderer needs a simplified ordered series of recent points containing:

- timestamp
- primary metric value

Primary metric value rules:

- `Claude Code`: the best available current window percent, preferring the same logic used for the primary snapshot percent
- `OpenAI Codex`: usage percent when available
- `NewAPI`: used USD value

The series should be light enough that the desktop UI can render charts without direct database access.

## UI Composition

### Compact Strip

The compact strip contains exactly three tiles laid out horizontally:

- source icon
- source label
- main usage number
- progress line
- percent

The tile values should be source-specific:

- `Claude Code`: current primary usage number and percent
- `OpenAI Codex`: current primary usage number and percent
- `NewAPI`: used USD and percent of total quota

### Expanded Header

The expanded panel header contains:

- title: `Usage Monitor`
- live indicator
- visual time controls
- close button

### Expanded Source Cards

The expanded panel contains three stacked cards in a fixed order:

1. `Claude Code`
2. `OpenAI Codex`
3. `NewAPI`

#### Claude Code Card

The card should include:

- source label and icon
- current primary limit badge when available
- used summary and percent
- progress bar
- chart for recent `last_5_hours` data
- two compact metric cards using current snapshot data

Expected metric emphasis:

- current short window usage
- current longer window usage or current absolute fallback when exact amounts are unavailable

#### OpenAI Codex Card

The card should include:

- source label and icon
- current limit badge when available
- used summary and percent
- progress bar
- chart for recent `last_5_hours` data
- two compact metric cards

If exact absolute values are still unavailable, the card should still render the percent and history visual with honest missing-value copy instead of estimation.

#### NewAPI Card

The card should include:

- source label and icon
- current percent
- progress bar
- summary cards for:
  - `Today usage`
  - `Current quota`
- remaining amount rendered inline with the quota summary

`NewAPI` does not render a history chart in this iteration. It uses the same card system and visual hierarchy as the other two sources, but its emphasis is the USD summary block rather than a recent-history plot.

## Error Handling

The product must remain honest when source data is incomplete.

Rules:

- Do not estimate missing absolute quota values for `Claude Code` or `OpenAI Codex`.
- Do not fabricate chart points when no usable history exists.
- Preserve the last good snapshot when a refresh fails.
- Show degraded or broken states visually without removing the source card.
- `NewAPI` failures should preserve the last good USD values and mark the source as degraded.

## Backend Changes

The daemon should be revised as follows:

- Replace the current placeholder custom source path with a real `newapi` adapter
- Read `MININGLAMP_BASE_URL` and `MININGLAMP_API_KEY`
- Normalize the base URL before request construction
- Fetch subscription and usage payloads
- Map them into the shared snapshot structure using USD values
- Read recent `refresh_history` rows to build `last_5_hours` chart series
- Write current snapshots plus recent history into the materialized state JSON consumed by the desktop app

The desktop renderer should not directly query SQLite.

## Frontend Changes

The desktop app should be revised as follows:

- Replace hover expansion with click expansion
- Replace the current generic list renderer with a fixed three-source compact strip
- Replace the current generic expanded list with a fixed reference-driven panel
- Render history charts from materialized recent history
- Keep the renderer robust when one or more sources only expose percent-based data

## Testing Strategy

### Desktop Tests

Add renderer tests covering:

- only three compact tiles render
- the tiles are `Claude Code`, `OpenAI Codex`, and `NewAPI`
- click expands the detailed panel
- expanded view renders exactly three source cards
- `NewAPI` displays dollar-formatted values

### Daemon Tests

Add adapter and materialization tests covering:

- trailing slash base URL normalization
- `subscription` and `usage` payload mapping for `NewAPI`
- `total_usage / 100` conversion into USD
- failure handling with last-good preservation
- materialized history generation for the last 5 hours

## Non-Goals

These are explicitly out of scope for this iteration:

- supporting more than the fixed three sources
- a generic source configuration UI
- real weekly aggregation for `This week`
- source reordering
- hover-triggered expansion

## Implementation Boundaries

This is a redesign and data-source refinement, not a new product.

The implementation should reuse the existing Tauri shell, React renderer, SQLite storage, and refresh loop, while tightening the product around:

- fixed three-source scope
- click-to-expand interaction
- real `NewAPI` USD usage integration
- recent-history-driven charts
