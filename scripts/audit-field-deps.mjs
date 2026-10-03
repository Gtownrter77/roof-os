#!/usr/bin/env node
import { execFileSync } from "node:child_process";

// This advisory currently has no published patched version. Keep the exception narrow and explicit.
const allowedAdvisories = new Set(["GHSA-86w9-cpqp-85rv", "GHSA-vfj7-8cjw-p6xm"]);

let report;
let exitCode = 0;

try {
  const stdout = execFileSync(
    "npm",
    ["audit", "--prefix", "apps/field", "--audit-level=moderate", "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  report = JSON.parse(stdout);
} catch (error) {
  exitCode = error.status ?? 1;
  const stdout = error.stdout?.toString?.() ?? "";
  if (!stdout.trim()) {
    process.stderr.write(error.stderr?.toString?.() ?? "");
    process.exit(exitCode);
  }
  report = JSON.parse(stdout);
}

const vulnerabilities = report.vulnerabilities ?? {};
const cache = new Map();
const visiting = new Set();

function isAllowed(name) {
  if (cache.has(name)) return cache.get(name);
  if (visiting.has(name)) return true;

  const vuln = vulnerabilities[name];
  if (!vuln) return false;

  visiting.add(name);
  const result = (vuln.via ?? []).every((via) => {
    if (typeof via === "string") return isAllowed(via);
    if (!via || typeof via !== "object") return false;
    return allowedAdvisories.has(via.source) || [...allowedAdvisories].some((advisory) => String(via.url ?? "").includes(advisory));
  });
  visiting.delete(name);
  cache.set(name, result);
  return result;
}

const blocking = Object.entries(vulnerabilities).filter(([name, vuln]) => {
  const severity = vuln.severity;
  const highEnough = severity === "moderate" || severity === "high" || severity === "critical";
  return highEnough && !isAllowed(name);
});

if (blocking.length) {
  console.error("Field dependency audit found blocking vulnerabilities:");
  for (const [name, vuln] of blocking) {
    const advisories = (vuln.via ?? [])
      .map((via) => {
        if (typeof via === "string") return `dependency:${via}`;
        if (!via || typeof via !== "object") return "unknown";
        return `${via.source ?? "unknown"}${via.url ? ` (${via.url})` : ""}`;
      })
      .join(", ");
    const fix = vuln.fixAvailable
      ? typeof vuln.fixAvailable === "object"
        ? `fix:${vuln.fixAvailable.name}@${vuln.fixAvailable.version}${vuln.fixAvailable.isSemVerMajor ? " (major)" : ""}`
        : "fixAvailable"
      : "no-fix";
    console.error(`- ${name}: ${vuln.severity} — ${fix}${advisories ? ` — ${advisories}` : ""}`);
  }
  process.exit(1);
}

const allowed = Object.entries(vulnerabilities)
  .filter(([name]) => isAllowed(name))
  .map(([name, vuln]) => `${name} (${vuln.severity})`);

if (allowed.length) {
  console.warn(
    `Field dependency audit: allowing only the currently unpatched ${[...allowedAdvisories].join(", ")} dependency chains: ${allowed.join(", ")}.`
  );
}

process.exit(0);
