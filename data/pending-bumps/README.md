# Pending CE bumps

Drop one JSON file per completed write-back. `CE board sync` (daily ~09:00 America/Chicago, or **Run workflow**) applies these files and moves them to `data/applied-bumps/`.

An empty folder (no `*.json`) is a no-op.

```json
{
  "agentId": "hr-helper",
  "date": "2026-09-21",
  "notes": "ORG CE: one-line lock citing the primary source."
}
```

`agentId` must already be on the roster. Do not put Spinoff content or PHI here. See the README section "Bump after CE".
