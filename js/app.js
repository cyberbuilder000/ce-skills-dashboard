/**
 * CE Skills & Capabilities Dashboard
 * Loads data/ce-metrics.json and renders all computed metrics.
 */
(function () {
  "use strict";

  const DATA_URL = "data/ce-metrics.json";

  const RUBRIC = [
    { score: 1, label: "Emerging", desc: "Learning basics; needs heavy guidance" },
    { score: 2, label: "Developing", desc: "Can follow drills with coaching; stream queued" },
    { score: 3, label: "Competent", desc: "Completes drills and write-backs reliably" },
    { score: 4, label: "Proficient", desc: "Owns cadence; cites primary sources well" },
    { score: 5, label: "Expert", desc: "Sets method; mentors others; high rigor" },
  ];

  function parseDateUTC(iso) {
    if (!iso) return null;
    const d = new Date(iso + (iso.length === 10 ? "T12:00:00Z" : ""));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function daysBetween(fromDate, toDate) {
    const ms = toDate.getTime() - fromDate.getTime();
    return Math.floor(ms / 86400000);
  }

  function rate(num, den) {
    if (den === 0) return null;
    return num / den;
  }

  function fmtPct(r) {
    if (r === null || r === undefined) return "N/A";
    return (r * 100).toFixed(0) + "%";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function skillLabel(skillsCatalog, id) {
    const found = (skillsCatalog || []).find((s) => s.id === id);
    return found ? found.name : id;
  }

  function staleInfo(agent, team, data, asOfDate) {
    const last = parseDateUTC(agent.lastWriteBackAt);
    if (!last) {
      return { days: null, band: "gray", label: "Never" };
    }
    const days = daysBetween(last, asOfDate);
    const isMedical = team.cadence === "weekly" || team.id === "medical";
    const green = isMedical
      ? data.targets.staleDaysGreenMedical
      : data.targets.staleDaysGreenBiweekly;
    const yellow = green + 7;
    let band;
    if (days <= green) band = "green";
    else if (days <= yellow) band = "yellow";
    else band = "red";
    return { days, band, label: days + "d" };
  }

  function agentMetrics(agent, team, data, asOfDate) {
    const drillsDone = agent.drillsDoneInPeriod || 0;
    const writeBacks = agent.writeBacksInPeriod || 0;
    const writeBackRate = rate(writeBacks, drillsDone);
    const primarySourceRigor = rate(agent.primarySourceCitedCount || 0, writeBacks);
    const stale = staleInfo(agent, team, data, asOfDate);
    return {
      drillsDone,
      writeBacks,
      writeBackRate,
      primarySourceRigor,
      stale,
      skillsPromoted: agent.skillsPromotedCount || 0,
    };
  }

  function teamAggregates(team, data, asOfDate) {
    let drillsDone = 0;
    let writeBacks = 0;
    let primaryCited = 0;
    let skillsPromoted = 0;
    let staleAlerts = 0;
    const expected = team.drillsExpectedInPeriod || 0;

    for (const agent of team.agents || []) {
      const m = agentMetrics(agent, team, data, asOfDate);
      drillsDone += m.drillsDone;
      writeBacks += m.writeBacks;
      primaryCited += agent.primarySourceCitedCount || 0;
      skillsPromoted += m.skillsPromoted;
      if (m.stale.band === "red" || m.stale.band === "yellow") {
        staleAlerts += 1;
      } else if (m.stale.band === "gray" && expected > 0 && team.cadence !== "meta") {
        staleAlerts += 1;
      }
    }

    return {
      drillsDone,
      drillsExpected: expected,
      drillCompletionRate: rate(drillsDone, expected),
      writeBacks,
      writeBackRate: rate(writeBacks, drillsDone),
      primarySourceRigor: rate(primaryCited, writeBacks),
      skillsPromoted,
      staleAlerts,
    };
  }

  function orgAggregates(data, asOfDate) {
    let drillsDone = 0;
    let drillsExpected = 0;
    let writeBacks = 0;
    let primaryCited = 0;
    let skillsPromoted = 0;
    let staleAlerts = 0;

    for (const team of data.teams || []) {
      const t = teamAggregates(team, data, asOfDate);
      drillsDone += t.drillsDone;
      drillsExpected += t.drillsExpected;
      writeBacks += t.writeBacks;
      primaryCited += (team.agents || []).reduce(
        (s, a) => s + (a.primarySourceCitedCount || 0),
        0
      );
      skillsPromoted += t.skillsPromoted;
      staleAlerts += t.staleAlerts;
    }

    return {
      drillsDone,
      drillsExpected,
      drillCompletionRate: rate(drillsDone, drillsExpected),
      writeBacks,
      writeBackRate: rate(writeBacks, drillsDone),
      primarySourceRigor: rate(primaryCited, writeBacks),
      skillsPromoted,
      staleAlerts,
    };
  }

  function cadenceBadge(cadence) {
    const c = escapeHtml(cadence || "unknown");
    return `<span class="badge badge-${c}">${c}</span>`;
  }

  function staleChip(stale) {
    return `<span class="chip chip-${stale.band}">${escapeHtml(stale.label)}</span>`;
  }

  function scorePill(score) {
    const s = Number(score) || 0;
    return `<span class="score-pill score-${s}" title="Capability ${s}/5">${s}</span>`;
  }

  function skillChips(ids, catalog) {
    if (!ids || !ids.length) {
      return `<span class="muted">—</span>`;
    }
    return (
      `<div class="skill-chips">` +
      ids
        .map(
          (id) =>
            `<span class="chip skill-chip" title="${escapeHtml(id)}">${escapeHtml(
              skillLabel(catalog, id)
            )}</span>`
        )
        .join("") +
      `</div>`
    );
  }

  function renderSummary(org, asOf) {
    const el = document.getElementById("summary-cards");
    const staleClass = org.staleAlerts > 0 ? "alert-stale" : "ok";
    const dcrClass =
      org.drillCompletionRate !== null && org.drillCompletionRate >= 1 ? "ok" : "";
    const wbrClass =
      org.writeBackRate !== null && org.writeBackRate >= 1 ? "ok" : "";

    el.innerHTML = `
      <div class="card summary">
        <div class="label">As Of</div>
        <div class="value" style="font-size:1.25rem">${escapeHtml(asOf)}</div>
        <div class="hint">Source: ce-metrics.json</div>
      </div>
      <div class="card summary ${dcrClass}">
        <div class="label">Drill Completion Rate</div>
        <div class="value">${fmtPct(org.drillCompletionRate)}</div>
        <div class="hint">${org.drillsDone} / ${org.drillsExpected} drills · target 100%</div>
      </div>
      <div class="card summary ${wbrClass}">
        <div class="label">Write-Back Rate</div>
        <div class="value">${fmtPct(org.writeBackRate)}</div>
        <div class="hint">${org.writeBacks} write-backs · target 100%</div>
      </div>
      <div class="card summary ${staleClass}">
        <div class="label">Stale Alerts</div>
        <div class="value">${org.staleAlerts}</div>
        <div class="hint">Yellow / red / never (operating teams)</div>
      </div>
    `;
  }

  function renderBenchmarking(data) {
    const el = document.getElementById("benchmarking-body");
    const defs = data.metricDefs || [];
    el.innerHTML = defs
      .map((d) => {
        const target =
          d.target === null || d.target === undefined
            ? "—"
            : typeof d.target === "number"
              ? fmtPct(d.target)
              : escapeHtml(String(d.target));
        return `<tr>
          <td><strong>${escapeHtml(d.name)}</strong><div class="muted" style="font-size:0.75rem">${escapeHtml(d.id)}</div></td>
          <td class="formula">${escapeHtml(d.formula)}</td>
          <td>${target}</td>
          <td class="muted">${escapeHtml(d.notes || "")}</td>
        </tr>`;
      })
      .join("");
  }

  function renderRubric() {
    const el = document.getElementById("rubric-legend");
    el.innerHTML = RUBRIC.map(
      (r) => `
      <div class="rubric-item">
        ${scorePill(r.score)}
        <div class="desc">
          <strong>${escapeHtml(r.label)}</strong>
          <span>${escapeHtml(r.desc)}</span>
        </div>
      </div>`
    ).join("");
  }

  function collectTeamSkills(team, catalog) {
    const set = new Map();
    for (const a of team.agents || []) {
      for (const id of a.skills || []) {
        if (!set.has(id)) set.set(id, skillLabel(catalog, id));
      }
    }
    return [...set.entries()].map(([id, name]) => ({ id, name }));
  }

  function renderTeams(data, asOfDate) {
    const root = document.getElementById("teams-root");
    const catalog = data.skills || [];

    root.innerHTML = (data.teams || [])
      .map((team) => {
        const agg = teamAggregates(team, data, asOfDate);
        const teamSkills = collectTeamSkills(team, catalog);

        const rows = (team.agents || [])
          .map((agent) => {
            const m = agentMetrics(agent, team, data, asOfDate);
            const wall = agent.wallCompliant
              ? `<span class="wall-ok">✓</span>`
              : `<span class="wall-fail">✗ WALL</span>`;
            return `<tr>
              <td><strong>${escapeHtml(agent.name)}</strong><div class="muted" style="font-size:0.75rem">${escapeHtml(agent.role || "")}</div></td>
              <td>${scorePill(agent.capabilityScore)}</td>
              <td>${m.drillsDone}</td>
              <td>${m.writeBacks}</td>
              <td>${fmtPct(m.writeBackRate)}</td>
              <td>${staleChip(m.stale)}</td>
              <td>${fmtPct(m.primarySourceRigor)}</td>
              <td>${m.skillsPromoted}</td>
              <td>${skillChips(agent.skills, catalog)}</td>
              <td class="muted" style="max-width:14rem;font-size:0.8rem">${escapeHtml(agent.capabilityNotes || "—")}</td>
              <td>${wall}</td>
            </tr>`;
          })
          .join("");

        const skillsBlock =
          teamSkills.length > 0
            ? skillChips(
                teamSkills.map((s) => s.id),
                catalog
              )
            : `<span class="muted">No skills tagged yet</span>`;

        return `
        <article class="team-block" id="team-${escapeHtml(team.id)}">
          <div class="team-header">
            <h3>${escapeHtml(team.name)} ${cadenceBadge(team.cadence)}</h3>
            <div class="team-meta">
              <span class="team-stat">DCR <strong>${fmtPct(agg.drillCompletionRate)}</strong> (${agg.drillsDone}/${agg.drillsExpected})</span>
              <span class="team-stat">WBR <strong>${fmtPct(agg.writeBackRate)}</strong></span>
              <span class="team-stat">PSR <strong>${fmtPct(agg.primarySourceRigor)}</strong></span>
              <span class="team-stat">Promoted <strong>${agg.skillsPromoted}</strong></span>
              <span class="team-stat">Stale alerts <strong>${agg.staleAlerts}</strong></span>
            </div>
          </div>
          <div class="team-body">
            <div class="agents-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Score</th>
                    <th>Drills</th>
                    <th>Write-backs</th>
                    <th>WBR</th>
                    <th>Stale</th>
                    <th>PSR</th>
                    <th>Promoted</th>
                    <th>Skills</th>
                    <th>Notes</th>
                    <th>Wall</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div class="skills-row">
              <h4>Skills / capabilities · ${escapeHtml(team.name)}</h4>
              ${skillsBlock}
            </div>
          </div>
        </article>`;
      })
      .join("");
  }

  function renderToc(data) {
    const nav = document.getElementById("toc");
    const links = [
      { href: "#summary", label: "Summary" },
      { href: "#benchmarking", label: "Benchmarking" },
      { href: "#teams", label: "Teams" },
      { href: "#rubric", label: "Rubric" },
      { href: "#wall", label: "Wall notice" },
    ];
    (data.teams || []).forEach((t) => {
      links.push({ href: `#team-${t.id}`, label: t.name });
    });
    nav.innerHTML = links
      .map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.label)}</a>`)
      .join("");
  }

  function showError(msg) {
    const el = document.getElementById("app");
    el.innerHTML = `<div class="error-banner"><strong>Failed to load metrics.</strong> ${escapeHtml(
      msg
    )} Serve this folder over HTTP (not file://) so fetch can read data/ce-metrics.json.</div>`;
  }

  async function main() {
    let data;
    try {
      const res = await fetch(DATA_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${DATA_URL}`);
      data = await res.json();
    } catch (err) {
      showError(err.message || String(err));
      return;
    }

    const asOfDate = parseDateUTC(data.asOf) || new Date();
    const org = orgAggregates(data, asOfDate);

    document.getElementById("asof-display").textContent = data.asOf;
    document.title = `CE Dashboard · ${data.asOf}`;

    renderToc(data);
    renderSummary(org, data.asOf);
    renderBenchmarking(data);
    renderTeams(data, asOfDate);
    renderRubric();

    document.getElementById("loading").hidden = true;
    document.getElementById("dashboard").hidden = false;
  }

  window.CEDashboard = {
    rate,
    staleInfo,
    agentMetrics,
    teamAggregates,
    orgAggregates,
    daysBetween,
    parseDateUTC,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
