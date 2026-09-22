#!/usr/bin/env node
/**
 * Idempotent CE board bump for data/ce-metrics.json.
 *
 * One write-back per agent per calendar date. Re-running the same
 * agentId + date + notes does not increment counts again.
 *
 *   node scripts/bump-ce-agent.mjs --agent <id> --date YYYY-MM-DD --notes "<lock>"
 *       [--lane <lane>] [--milestone "<item>"] [--metrics <path>]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SKILL_ID = "berean-ce-write-back";
export const DEFAULT_METRICS = resolve("data/ce-metrics.json");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SPINOFF_RE = /spin[\s-]*off/i;

export function assertNoSpinoff(label, text) {
  if (text && SPINOFF_RE.test(String(text))) {
    throw new Error(
      `${label} mentions Spinoff. Public metrics are Spinoff-redacted; refused.`
    );
  }
}

export function loadMetrics(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Pretty-print and keep non-ASCII as \\u escapes so rewrites stay stable. */
export function metricsToText(data) {
  return (
    JSON.stringify(data, null, 2).replace(/[\u007f-\uffff]/g, (ch) => {
      return "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0");
    }) + "\n"
  );
}

export function saveMetrics(path, data) {
  writeFileSync(path, metricsToText(data));
}

function findAgent(data, agentId) {
  for (const team of data.teams || []) {
    for (const agent of team.agents || []) {
      if (agent.id === agentId) return agent;
    }
  }
  return null;
}

function ensureSkill(agent) {
  if (!Array.isArray(agent.skills)) agent.skills = [];
  if (!agent.skills.includes(SKILL_ID)) agent.skills.push(SKILL_ID);
}

function ensureFloors(agent) {
  agent.drillsDoneInPeriod = Math.max(Number(agent.drillsDoneInPeriod) || 0, 1);
  agent.writeBacksInPeriod = Math.max(Number(agent.writeBacksInPeriod) || 0, 1);
  agent.primarySourceCitedCount = Math.max(
    Number(agent.primarySourceCitedCount) || 0,
    1
  );
  ensureSkill(agent);
  agent.wallCompliant = true;
}

function appendMilestone(data, date, lane, item) {
  const laneText = lane ? String(lane).trim() : "";
  const itemText = item ? String(item).trim() : "";
  if (!laneText && !itemText) return false;
  if (!laneText || !itemText) {
    throw new Error("milestone requires both lane and milestone text");
  }
  assertNoSpinoff("lane", laneText);
  assertNoSpinoff("milestone", itemText);
  if (!data.ceProgression || typeof data.ceProgression !== "object") {
    data.ceProgression = { milestones: [] };
  }
  if (!Array.isArray(data.ceProgression.milestones)) {
    data.ceProgression.milestones = [];
  }
  const exists = data.ceProgression.milestones.some(
    (m) => m && m.date === date && m.lane === laneText && m.item === itemText
  );
  if (exists) return false;
  data.ceProgression.milestones.push({ date, lane: laneText, item: itemText });
  return true;
}

/**
 * Apply one bump onto an in-memory metrics object.
 * Does not invent agents. Idempotent on (agentId, date, notes).
 * @returns {{agentId: string, date: string, incremented: boolean, changed: boolean}}
 */
export function applyBump(data, event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("bump must be a JSON object");
  }
  const agentId = String(event.agentId || "").trim();
  const date = String(event.date || "").trim();
  const notes = String(event.notes ?? "");
  if (!agentId) throw new Error("agentId is required");
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00Z`))) {
    throw new Error(`date must be YYYY-MM-DD, got ${JSON.stringify(event.date)}`);
  }
  if (!notes.trim()) throw new Error("notes are required");
  assertNoSpinoff("agentId", agentId);
  assertNoSpinoff("notes", notes);

  const agent = findAgent(data, agentId);
  if (!agent) {
    throw new Error(
      `unknown agentId ${JSON.stringify(agentId)}; will not invent a roster row`
    );
  }

  const priorDate = agent.lastWriteBackAt || null;
  const priorNotes = String(agent.capabilityNotes || "");
  const priorScore = Number(agent.capabilityScore) || 0;
  const priorNotesEmpty = !priorNotes.trim();
  const sameDay = priorDate === date;
  const sameNotes = priorNotes === notes;

  if (priorDate && date < priorDate) {
    throw new Error(
      `${agentId} lastWriteBackAt is ${priorDate}, which is after ${date}; refusing to move the board backward`
    );
  }

  const before = JSON.stringify(data);
  const drillsBefore = Number(agent.drillsDoneInPeriod) || 0;

  if (!(sameDay && sameNotes)) {
    if (priorDate && !sameDay) {
      agent.drillsDoneInPeriod = drillsBefore + 1;
      agent.writeBacksInPeriod = (Number(agent.writeBacksInPeriod) || 0) + 1;
      agent.primarySourceCitedCount =
        (Number(agent.primarySourceCitedCount) || 0) + 1;
    }
    agent.lastWriteBackAt = date;
    agent.capabilityNotes = notes;
    if (priorScore === 2 && priorNotesEmpty) {
      agent.capabilityScore = 3;
    }
  }

  ensureFloors(agent);

  if (typeof data.asOf !== "string" || date > data.asOf) {
    data.asOf = date;
  }

  appendMilestone(data, date, event.lane, event.milestone);

  const incremented = (Number(agent.drillsDoneInPeriod) || 0) > drillsBefore;
  return {
    agentId,
    date,
    incremented,
    changed: JSON.stringify(data) !== before,
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected argument ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for --${key}`);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const metricsPath = resolve(args.metrics || DEFAULT_METRICS);
  const data = loadMetrics(metricsPath);
  const result = applyBump(data, {
    agentId: args.agent,
    date: args.date,
    notes: args.notes,
    lane: args.lane,
    milestone: args.milestone,
  });
  if (result.changed) saveMetrics(metricsPath, data);
  const verb = !result.changed
    ? "unchanged"
    : result.incremented
      ? "incremented"
      : "updated";
  console.log(`${verb} ${result.agentId} ${result.date}`);
}

if (isDirectRun()) {
  try {
    main();
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exit(1);
  }
}
