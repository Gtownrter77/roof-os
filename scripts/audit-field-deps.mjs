#!/usr/bin/env node
import {execFileSync} from "node:child_process";
import fs from "node:fs";
const REMEDIATIONS={"GHSA-86w9-cpqp-85rv":{packageName:"node-forge",requiredResolved:"github:Krysthyan/forge#ceba34402e329f0365134f23fe19898756527d65"}};
let report;
try{report=JSON.parse(execFileSync("npm",["audit","--prefix","apps/field","--audit-level=moderate","--json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));}
catch(error){const stdout=error.stdout?.toString?.()??"";if(!stdout.trim()){process.stderr.write(error.stderr?.toString?.()??"");process.exit(error.status??1)}report=JSON.parse(stdout)}
const vulnerabilities=report.vulnerabilities??{},lock=JSON.parse(fs.readFileSync("apps/field/package-lock.json","utf8")),packages=lock.packages??{},cache=new Map();
function source(v){if(!v||typeof v!=="object")return null;if(typeof v.source==="string")return v.source;if(typeof v.url==="string")return v.url.split("/").filter(Boolean).at(-1)??null;return null}
function advisories(name,visiting=new Set()){if(cache.has(name))return cache.get(name);if(visiting.has(name))return new Set();const vuln=vulnerabilities[name];if(!vuln)return new Set();const next=new Set(visiting);next.add(name);let found=new Set();for(const via of vuln.via??[]){if(typeof via==="string"){for(const x of advisories(via,next))found.add(x)}else{const x=source(via);if(x)found.add(x)}}cache.set(name,found);return found}
function remediated(id){const r=REMEDIATIONS[id],e=r&&packages["node_modules/"+r.packageName];return !!(e?.resolved&&e.resolved.includes(r.requiredResolved))}
const blocking=[],fixed=[];
for(const [name,vuln] of Object.entries(vulnerabilities)){if(!["moderate","high","critical"].includes(vuln.severity))continue;const ids=[...advisories(name)],unresolved=ids.filter(id=>!remediated(id));if(ids.length&&!unresolved.length)fixed.push(name+" ("+vuln.severity+"): "+ids.join(", "));else blocking.push([name,vuln.severity,unresolved])}
if(blocking.length){console.error("Field dependency audit found unresolved blocking vulnerabilities:");for(const [name,severity,ids] of blocking)console.error("- "+name+": "+severity+"; advisories: "+(ids.join(", ")||"unknown"));process.exit(1)}
if(fixed.length){console.warn("Field dependency audit: exact pinned mitigations verified in package-lock:");for(const x of fixed)console.warn("- "+x)}
