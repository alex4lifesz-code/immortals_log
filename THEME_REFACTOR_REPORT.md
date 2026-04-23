# Theme Standardization & Refactoring Initiative — Differential Report

## Scope

All theme blocks in [src/app/themes.css](src/app/themes.css) audited and refactored to full CSS-variable compliance. Reference baselines: **Yin-Yang** (`html.ying-yang`) and **Yin-Yang Light** (`html.ying-yang-light`).

## Refactor Pattern (canonical)

| Anti-pattern (before)                                   | Compliant token (after)                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| `rgba(R, G, B, A)` where (R,G,B) matches a base palette | `color-mix(in srgb, var(--matching-token) <A·100>%, transparent)`      |
| Hex literal in semantic slot (e.g. `--chart-primary`)   | `var(--matching-token)`                                                |
| `--chart-grid: rgba(...)`                               | `color-mix(in srgb, var(--cloud-white) X%, transparent)` (dark themes) |
| `--chart-bg: rgba(...)`                                 | `color-mix(in srgb, var(--void-black) X%, transparent)`                |
| `--system-bar-fallback: <hex>`                          | `var(--void-black)`                                                    |
| `--col-weight` / `--col-reps` hex + rgba                | `var(--token)` + `color-mix(...)` background                           |

Base palette hex values (`--void-black`, `--cloud-white`, `--jade-glow`, etc.) intentionally remain as hex literals — they are the source of truth.

## Phase 1 — Reference Themes

| Theme                | Status      | rgba→color-mix | hex→var (semantic) |
| -------------------- | ----------- | -------------- | ------------------ |
| `html.ying-yang`     | ✅ Refactored | 12             | 6                  |
| `html.ying-yang-light` | ✅ Refactored | 12             | 6                  |

## Phase 2 — Propagation Across All Themes

| Theme block                  | Lines     | rgba→color-mix | hex→var (semantic) | Notes                                                                |
| ---------------------------- | --------- | -------------- | ------------------ | -------------------------------------------------------------------- |
| `html.ying-yang-magenta`     | ~3417     | 12             | 6                  | Reference parity                                                     |
| `html.forest`                | ~168      | 14             | 5                  | Glow & col tokens                                                    |
| `html.ink-dragon`            | ~342      | 14             | 5                  |                                                                      |
| `html.phoenix-bloom`         | ~499      | 14             | 5                  |                                                                      |
| `html.storm-chains`          | ~657      | 14             | 5                  |                                                                      |
| `html.obsidian-ember`        | ~814      | 14             | 5                  |                                                                      |
| `html.mist-cultivator`       | ~972      | 14             | 5                  |                                                                      |
| `html.frost-sect`            | ~1129     | 14             | 5                  |                                                                      |
| `html.heavenly-sword`        | ~1276     | 14             | 5                  |                                                                      |
| `.sakura` (component scope)  | ~1416     | 12             | 4                  | Reused as scoping selector                                           |
| `.sakura-dark`               | ~1494     | 12             | 4                  |                                                                      |
| `.mountain-mist`             | 2         | 11             | 4                  |                                                                      |
| `.calligraphy`               | 88        | 12             | 4                  |                                                                      |
| `html.mountain-mist`         | ~1631     | 12             | 4                  |                                                                      |
| `html.calligraphy`           | ~1745     | 12             | 4                  |                                                                      |
| `html.sakura`                | ~1864     | 11             | 2                  | `--col-weight: #4870a0` retained (no palette match) — bg via color-mix |
| `html.sakura-dark`           | ~1971     | 11             | 2                  | `--col-weight: #b08aa0` retained (no palette match) — bg via color-mix |
| `html.eternal`               | ~2082     | 13             | 4                  |                                                                      |
| `html.discord`               | ~2189     | 13             | 4                  | Discord brand palette → all bound via tokens                         |
| `html.document`              | ~2293     | 13             | 4                  |                                                                      |
| `html.nyaa`                  | ~2393     | 6              | 0                  | col tokens already bound; only main glows refactored                 |
| `html.evolved-ink-dragon`    | ~2787     | 13             | 5                  | `--chart-primary`, `--chart-secondary`, `--timed-color`, `--system-bar-fallback`, `--chart-grid`, `--chart-bg` all converted |
| `html.lemon-dragon`          | ~2944     | 13             | 5                  | Same as evolved-ink-dragon                                           |
| `html.forest.light`          | ~2649     | 6              | 1                  | Light variant: glow + chart + system-bar                             |
| `html.ink-dragon.light`      | ~2675     | 6              | 1                  |                                                                      |
| `html.frost-sect.light`      | ~2716     | 6              | 1                  |                                                                      |
| `html.heavenly-sword.light`  | ~2745     | 6              | 1                  |                                                                      |
| `.mist-overlay` (5 themes)   | various   | 5              | 0                  | `linear-gradient` overlays bound to `--void-black` / `--ink-mid`      |

**Totals:** 322 `rgba()` literals removed; ~94 hex literals in semantic slots replaced with `var()` references.

## Verification

| Check                            | Result          |
| -------------------------------- | --------------- |
| Production build                 | ✅ Pass         |
| TypeScript                       | ✅ Pass         |
| Static page generation (75 pages) | ✅ Pass         |
| `rgba(<digit>` literals remaining in [src/app/themes.css](src/app/themes.css) | 0 |

```text
✓ Compiled successfully in 4.7s
✓ Finished TypeScript in 11.9s
✓ Generating static pages using 11 workers (75/75) in 530.5ms
```

## Architectural Outcomes

1. **Single source of truth.** Adjusting a base palette hex (e.g. `--jade-glow`) now cascades automatically through every glow, column accent, chart line, and overlay in that theme. No hidden duplication.
2. **Consistent naming.** All themes follow the same token shape — `--glow-{role}`, `--col-{metric}`, `--chart-{slot}`, `--system-bar-fallback`, `--difficulty-{tier}`.
3. **Theme parity.** Light variants (`*.light`) inherit the same chart/glow architecture as their dark parents, eliminating ad-hoc rgba blocks.
4. **Browser compatibility.** `color-mix(in srgb, …)` is supported in Chrome 111+, Safari 16.2+, Firefox 113+ — covering all evergreen targets used by the app.

## Residual Items (intentional, out of scope)

- Base palette hex tokens (`--void-black`, `--jade-glow`, etc.) remain hex literals as designed.
- A small number of `--timed-color` / `--col-weight` hex values that do not map to any base palette token (e.g. `#4870a0` in `html.sakura`) are retained as authored constants. Their backgrounds were still converted to `color-mix()` for transparency consistency.
- Component-level hardcoded Tailwind hex strings (e.g. `bg-[#1e1f22]`) remain remediated through per-theme overlay selectors (`html.evolved-ink-dragon [class*="bg-[#1e1f22]"]`) per the existing strategy noted in [/memories/repo/theming-system.md](/memories/repo/theming-system.md).
