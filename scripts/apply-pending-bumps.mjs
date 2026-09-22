#!/usr/bin/env node
/**
 * Apply data/pending-bumps/*.json onto data/ce-metrics.json.
 * No JSON events → exit 0 and leave the board unchanged.
 * Applied files move to data/applied-bumps/. Invalid events abort
 * before any write, so a bad file does not partially update metrics.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyBump, loadMetrics, saveMetrics } from "./bump-ce-agent.mjs";

const pendingDir = resolve("data/pending-bumps");
const appliedDir = resolve("data/applied-bumps");
const metricsPath = resolve("data/ce-metrics.json");
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/;

function listPending() {
  if (!existsSync(pendingDir)) return [];
  return readdirSync(pendingDir)
    .filter((name) => NAME_RE.test(name))
    .sort();
}

function main() {
  const names = listPending();
  if (names.length === 0) {
    console.log("No pending bumps. Board unchanged.");
    return;
  }

  const events = names.map((name) => {
    const path = join(pendingDir, name);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      throw new Error(`${name}: invalid JSON (${err.message})`);
    }
    return { name, path, parsed };
  });

  const data = loadMetrics(metricsPath);
  let anyChanged = false;
  for (const event of events) {
    try {
      const result = applyBump(data, event.parsed);
      anyChanged = anyChanged || result.changed;
      const verb = !result.changed
        ? "already applied"
        : result.incremented
          ? "incremented"
          : "updated";
      console.log(`${event.name}: ${verb} ${result.agentId} ${result.date}`);
    } catch (err) {
      throw new Error(`${event.name}: ${err.message}`);
    }
  }

  if (anyChanged) saveMetrics(metricsPath, data);

  mkdirSync(appliedDir, { recursive: true });
  for (const event of events) {
    let dest = join(appliedDir, event.name);
    if (existsSync(dest)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      dest = join(appliedDir, event.name.replace(/\.json$/, `-${stamp}.json`));
    }
    renameSync(event.path, dest);
  }
  console.log(`Applied ${events.length} pending bump(s).`);
}

try {
  main();
} catch (err) {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
}
