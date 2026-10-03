#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const allowedAdvisories = new Set(["GHSA-86w9-cpqp-85rv"]);
let report;
try {
  report = JSON.parse(execFileSync("npm", ["audit", "--prefix", "apps/field", "--audit-level=moderate", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
} catch (error) {
  const stdout = error.stdout?.toString?.() ?? "";
  if (!stdout.trim()) {
    process.stderr.write(error.stderr?.toString?.() ?? "");
    process.exit(error.status ?? 1);
  }
  report = JSON.parse(stdout);
}

const vulnerabilities = report.vulnerabilities ?? {};
const cache = new Map();

function advisorySource(via) {
  if (!via || typeof via !== "object") return null;
  return via.source ?? (typeof via.url === "string" ? via.url.split("/").pop() : null);
}

function collectAdvisories(name, visiting = new Set()) {
  if (cache.has(name)) return cache.get(name);
  if (visiting.has(name)) return new Set();
  const vuln = vulnerabilities[name];
  if (!vuln) return new Set();
  const nextVisiting = new Set(visiting);
  nextVisiting.add(name);
  const found = new Set();
  for (const via of vuln.via ?? []) {
    if (typeof via === "string") {
      for (const advisory of collectAdvisories(via, nextVisiting)) found.add(advisory);
    } else {
      const source = advisorySource(via);
      if (source) found.add(source);
    }
  }
  cache.set(name, found);
  return found;
}

const blocking = Object.entries(vulnerabilities).filter(([name, vuln]) => {
  const severity = vuln.severity;
  const highEnough = severity === "moderate" || severity === "high" || severity === "critical";
  if (!highEnough) return false;
  const advisories = collectAdvisories(name);
  return advisories.size === 0 || [...advisories].some((advisory) => ![...allowedAdvisories].some((allowed) => advisory.includes(allowed)));
});

if (blocking.length) {
  console.error("Field dependency audit found blocking vulnerabilities:");
  for (const [name, vuln] of blocking) {
    console.error(`- ${name}: ${vuln.severity}; advisories: ${[...collectAdvisories(name)].join(", ") || "unknown"}`);
  }
  process.exit(1);
}

const allowed = Object.entries(vulnerabilities)
  .filter(([name]) => [...collectAdvisories(name)].some((advisory) => [...allowedAdvisories].some((allowed) => advisory.includes(allowed))))
  .map(([name, vuln]) => `${name} (${vuln.severity})`);

if (allowed.length) {
  console.warn(`Field dependency audit: only the explicitly allowed unpatched advisory chain remains: ${allowed.join(", ")}.`);
}

process.exit(0);
