#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import fs from "node:fs";
import {parseAuditReport, classifyVulnerabilities} from "../lib/field-deps-audit.mjs";
const REMEDIATIONS={"GHSA-86w9-cpqp-85rv":{packageName:"node-forge",requiredResolved:"https://registry.npmjs.org/node-forge/-/node-forge-1.4.3.tgz"},"GHSA-gcqx-w48m-w2h4":{packageName:"deepmerge",requiredResolved:"vendor/deepmerge"},"GHSA-fc5q-39xc-vjpf":{buildToolOnly:true,reason:"Upstream picomatch advisory is carried by Expo/Metro/Jest build tooling; no patched picomatch release exists in the reviewed registry range and these packages are not shipped in the APK runtime bundle."}};
let report;
try{report=parseAuditReport(execFileSync("npm",["audit","--prefix","apps/field","--audit-level=moderate","--json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));}
catch(error){const stdout=error.stdout?.toString?.()??"";if(!stdout.trim()){process.stderr.write(error.stderr?.toString?.()??"");process.exit(error.status??1)}report=parseAuditReport(stdout)}
const vulnerabilities=report.vulnerabilities,lock=JSON.parse(fs.readFileSync("apps/field/package-lock.json","utf8")),packages=lock.packages??{};
const forge=packages["node_modules/node-forge"];
if(forge?.version!=="1.4.3"||forge?.resolved!=="https://registry.npmjs.org/node-forge/-/node-forge-1.4.3.tgz"||forge?.integrity!=="sha512-P6wzfh6t70avmV8FrVEAd/36sOPJQ+hkaJVX1Laap9J/77m7M0eyozDvc8SwnDf4P7MP94gwbAAo0rg3YVXT+g=="){console.error("Field dependency audit: node-forge must resolve to the reviewed official npm 1.4.3 artifact.");process.exit(1)}
let deepmergeMitigationPassed;
function deepmergeMitigationValid() {
  if (deepmergeMitigationPassed !== undefined) return deepmergeMitigationPassed;
  const entry = packages["node_modules/deepmerge"];
  if (entry?.resolved !== "vendor/deepmerge" || entry?.link !== true || packages["vendor/deepmerge"]?.version !== "4.3.1-roofos.1") return (deepmergeMitigationPassed = false);
  try { execFileSync(process.execPath, ["scripts/test-field-deepmerge-mitigation.cjs"], {stdio:"ignore"}); return (deepmergeMitigationPassed = true); }
  catch { return (deepmergeMitigationPassed = false); }
}
function remediated(id){if(id==="GHSA-gcqx-w48m-w2h4")return deepmergeMitigationValid();const r=REMEDIATIONS[id];if(r?.buildToolOnly)return true;const e=r&&packages["node_modules/"+r.packageName];return !!(e?.resolved&&e.resolved.includes(r.requiredResolved))}
const {blocking,fixed}=classifyVulnerabilities(vulnerabilities,remediated);
if(blocking.length){console.error("Field dependency audit found unresolved blocking vulnerabilities:");for(const [name,severity,ids] of blocking)console.error("- "+name+": "+severity+"; advisories: "+(ids.join(", ")||"unknown"));process.exit(1)}
if(fixed.length){console.warn("Field dependency audit: exact pinned mitigations verified in package-lock:");for(const x of fixed)console.warn("- "+x)}
