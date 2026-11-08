#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import fs from "node:fs";
const REMEDIATIONS={"GHSA-86w9-cpqp-85rv":{packageName:"node-forge",requiredResolved:"https://registry.npmjs.org/node-forge/-/node-forge-1.4.3.tgz"},"GHSA-gcqx-w48m-w2h4":{packageName:"deepmerge",requiredResolved:"vendor/deepmerge"}};
let report;
try{report=JSON.parse(execFileSync("npm",["audit","--prefix","apps/field","--audit-level=moderate","--json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));}
catch(error){const stdout=error.stdout?.toString?.()??"";if(!stdout.trim()){process.stderr.write(error.stderr?.toString?.()??"");process.exit(error.status??1)}report=JSON.parse(stdout)}
const vulnerabilities=report.vulnerabilities??{},lock=JSON.parse(fs.readFileSync("apps/field/package-lock.json","utf8")),packages=lock.packages??{},cache=new Map();
const forge=packages["node_modules/node-forge"];
if(forge?.version!=="1.4.3"||forge?.resolved!=="https://registry.npmjs.org/node-forge/-/node-forge-1.4.3.tgz"||forge?.integrity!=="sha512-P6wzfh6t70avmV8FrVEAd/36sOPJQ+hkaJVX1Laap9J/77m7M0eyozDvc8SwnDf4P7MP94gwbAAo0rg3YVXT+g=="){console.error("Field dependency audit: node-forge must resolve to the reviewed official npm 1.4.3 artifact.");process.exit(1)}
function source(v){if(!v||typeof v!=="object")return null;if(typeof v.source==="string")return v.source;if(typeof v.url==="string")return v.url.split("/").filter(Boolean).at(-1)??null;return null}
function advisories(name,visiting=new Set()){if(cache.has(name))return cache.get(name);if(visiting.has(name))return new Set();const vuln=vulnerabilities[name];if(!vuln)return new Set();const next=new Set(visiting);next.add(name);let found=new Set();for(const via of vuln.via??[]){if(typeof via==="string"){for(const x of advisories(via,next))found.add(x)}else{const x=source(via);if(x)found.add(x)}}cache.set(name,found);return found}
let deepmergeMitigationPassed;
function deepmergeMitigationValid() {
  if (deepmergeMitigationPassed !== undefined) return deepmergeMitigationPassed;
  const entry = packages["node_modules/deepmerge"];
  if (entry?.resolved !== "vendor/deepmerge" || entry?.link !== true || packages["vendor/deepmerge"]?.version !== "4.3.1-roofos.1") return (deepmergeMitigationPassed = false);
  try { execFileSync(process.execPath, ["scripts/test-field-deepmerge-mitigation.cjs"], {stdio:"ignore"}); return (deepmergeMitigationPassed = true); }
  catch { return (deepmergeMitigationPassed = false); }
}
function remediated(id){if(id==="GHSA-gcqx-w48m-w2h4")return deepmergeMitigationValid();const r=REMEDIATIONS[id],e=r&&packages["node_modules/"+r.packageName];return !!(e?.resolved&&e.resolved.includes(r.requiredResolved))}
const blocking=[],fixed=[];
for(const [name,vuln] of Object.entries(vulnerabilities)){if(!["moderate","high","critical"].includes(vuln.severity))continue;const ids=[...advisories(name)],unresolved=ids.filter(id=>!remediated(id));if(ids.length&&!unresolved.length)fixed.push(name+" ("+vuln.severity+"): "+ids.join(", "));else blocking.push([name,vuln.severity,unresolved])}
if(blocking.length){console.error("Field dependency audit found unresolved blocking vulnerabilities:");for(const [name,severity,ids] of blocking)console.error("- "+name+": "+severity+"; advisories: "+(ids.join(", ")||"unknown"));process.exit(1)}
if(fixed.length){console.warn("Field dependency audit: exact pinned mitigations verified in package-lock:");for(const x of fixed)console.warn("- "+x)}
