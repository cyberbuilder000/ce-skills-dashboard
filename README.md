# CE Skills & Capabilities Dashboard

Static single-page dashboard for continuing-education (CE) drill progress, write-backs, skills, and capability scores.

**Wall-safe:** no PHI; no Spinoff strategy / Spinoff Forge content. Personal roster excludes Spinoff.

## Files

| Path | Role |
|------|------|
| `index.html` | Page shell |
| `css/styles.css` | Layout & stale color chips |
| `js/app.js` | Loads JSON, computes metrics, renders UI |
| `data/ce-metrics.json` | **Source of truth** — edit this to refresh |

## Refresh path

1. After each CE write-back (or period close), update `data/ce-metrics.json`:
   - bump `asOf` (ISO date)
   - set agent `drillsDoneInPeriod`, `writeBacksInPeriod`, `lastWriteBackAt`
   - update `primarySourceCitedCount`, `skillsPromotedCount`, `skills[]`, `capabilityScore` / notes
2. Republish the whole `ce-dashboard/` folder to any static host (no build step).
3. Open `index.html` over **HTTP** (browsers block `fetch` of JSON under `file://`).

Local preview:

```bash
cd /workspace/ce-dashboard
python3 -m http.server 8765
# open http://127.0.0.1:8765/
```

## Metric formulas (computed in JS from JSON)

| Metric | Formula | Target / bands |
|--------|---------|----------------|
| **DrillCompletionRate** | `drills_done / drills_expected_in_period` | Target **100%** (`targets.drillCompletionRate`) |
| **WriteBackRate** | `writebacks / drills_done` · **N/A** if `drills_done = 0` | Target **100%** |
| **StaleDays** | days since `lastWriteBackAt` (vs `asOf`) | Medical (weekly) green **≤ 8**; biweekly/meta green **≤ 14**; yellow = green + 7; else **red**; **null / gray** if never |
| **SkillsPromoted** | `sum(skillsPromotedCount)` | Informational |
| **PrimarySourceRigor** | `primarySourceCitedCount / writeBacks` | Target **100%**; N/A if no write-backs |
| **CapabilityScore** | Shown from JSON (1–5); not computed | Rubric legend on page |

Org summary cards: **asOf**, **DrillCompletionRate**, **WriteBackRate**, **stale alerts count** (yellow + red + “never” on operating teams; meta “never” does not auto-alert).

Period lengths in JSON: `periodDays.medical` (7), `periodDays.biweekly` (14). Each team’s `drillsExpectedInPeriod` drives DCR.

## Wall rules

- **No PHI** — do not put patient identifiers, clinical notes, or protected health data in JSON or UI copy.
- **No Spinoff** — omit Spinoff Forge and Spinoff strategy entirely from roster, skills, and notes.
- Keep `wallCompliant: true` only when the agent’s recorded CE content respects the wall.

## Publish to any static host

Copy the folder as-is (HTML/CSS/JS/JSON). Examples:

- **GitHub Pages / GitLab Pages / Cloudflare Pages / Netlify / S3+CloudFront / nginx** — upload or sync `ce-dashboard/` to the site root or a subpath.
- Ensure `data/ce-metrics.json` is publicly fetchable next to `index.html` (same origin or correct CORS if split).
- No Node build, no bundler required.

## Schema (high level)

- Root: `version`, `asOf`, `periodDays`, `targets`, `metricDefs[]`, `teams[]`, optional `skills[]`
- Team: `id`, `name`, `cadence` (`weekly` | `biweekly` | `meta`), `drillsExpectedInPeriod`, `agents[]`
- Agent: `id`, `name`, `role`, `capabilityScore`, `capabilityNotes`, `skills[]`, `drillsDoneInPeriod`, `writeBacksInPeriod`, `lastWriteBackAt` (ISO date or `null`), `primarySourceCitedCount`, `skillsPromotedCount`, `wallCompliant`

Baseline roster (2026-09-06) includes Medical, Eng, Factory, Personal (excl. Spinoff), Work, and COS/Darcy — see JSON.
