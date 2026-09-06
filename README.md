# CE Skills & Capabilities Dashboard

Static single-page dashboard for continuing-education (CE) drill progress, write-backs, skills, and capability scores.

**Canonical URL:** [https://cyberbuilder000.github.io/ce-skills-dashboard/](https://cyberbuilder000.github.io/ce-skills-dashboard/)

**Publish default:** GitHub Pages (edit `data/ce-metrics.json`, commit, `git push` to `main`).

**here.now:** Leave alone per Michael. Document only — do **not** delete, overwrite, or use here.now for future publishes of this dashboard.

**Wall:** Spinoff-redacted CE progression. Public CE stats only. No PHI. No Spinoff Forge or Spinoff strategy content, agents, or progression. Personal roster excludes Spinoff.

## Canonical publish (Michael standing order 2026-09-06)

- **Canonical URL:** https://cyberbuilder000.github.io/ce-skills-dashboard/
- **Default publish path:** GitHub Pages — edit `data/ce-metrics.json`, commit, `git push` (no build).
- **here.now:** leave alone; do not use for future publishes.
- **Wall:** public CE progression is **Spinoff-redacted** — no Spinoff Forge / Spinoff strategy content, agents, or milestones.


## Files

| Path | Role |
|------|------|
| `index.html` | Page shell (wall banner + progression + teams) |
| `css/styles.css` | Layout, wall banner, progression, stale chips |
| `js/app.js` | Loads JSON, computes metrics, renders UI |
| `data/ce-metrics.json` | **Source of truth** — edit this to refresh |

## Refresh / publish (GitHub default)

1. After each CE write-back (or period close), update `data/ce-metrics.json`:
   - bump `asOf` (ISO date)
   - set agent `drillsDoneInPeriod`, `writeBacksInPeriod`, `lastWriteBackAt`
   - update `primarySourceCitedCount`, `skillsPromotedCount`, `skills[]`, `capabilityScore` / notes
   - optionally append Spinoff-**safe** milestones under `ceProgression.milestones`
2. Commit and push to GitHub (`main`). GitHub Pages serves the canonical site.
3. Do **not** publish via here.now for this dashboard going forward.

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
- **No Spinoff** — omit Spinoff Forge and Spinoff strategy entirely from roster, skills, notes, and **CE progression** (`ceProgression.redactedLanes` / `redactedNote`).
- Public progression is **Spinoff-redacted** — only `visibleLanes` appear.
- Keep `wallCompliant: true` only when the agent’s recorded CE content respects the wall.
- `wall.publishDefault` is `github-pages`; `wall.canonicalUrl` points at the live Pages site.

## Schema (high level)

- Root: `version`, `asOf`, `periodDays`, `targets`, `wall`, `ceProgression`, `metricDefs[]`, `teams[]`, optional `skills[]`
- `wall`: `publishDefault`, `canonicalUrl`, `redactedLanes[]`, `notice`
- `ceProgression`: `title`, `visibleLanes[]`, `redactedNote`, `milestones[]` (`date`, `lane`, `item`)
- Team: `id`, `name`, `cadence` (`weekly` | `biweekly` | `meta`), `drillsExpectedInPeriod`, `agents[]`
- Agent: `id`, `name`, `role`, `capabilityScore`, `capabilityNotes`, `skills[]`, `drillsDoneInPeriod`, `writeBacksInPeriod`, `lastWriteBackAt` (ISO date or `null`), `primarySourceCitedCount`, `skillsPromotedCount`, `wallCompliant`

Baseline roster (2026-09-06) includes Medical, Eng, Factory, Personal (excl. Spinoff), Work, and COS/Darcy — see JSON.
