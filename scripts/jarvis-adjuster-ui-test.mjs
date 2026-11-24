import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const component = read('components/AdjusterControl.tsx')
const settings = read('app/settings/page.tsx')
const nav = read('lib/nav.ts')
const agents = read('lib/agents/agent-toggles.ts')

assert.match(component, /fetch\('\/api\/jarvis\/claims'/)
assert.match(component, /\/api\/jarvis\/claims\/\$\{claim\.id\}\/disable/)
assert.match(component, /disabled: true/)
assert.match(component, /Plan only until execution is explicitly authorized/)
assert.match(component, /consent-gated and recorded in the adjuster thread/)
assert.match(settings, /import AdjusterControl from/)
assert.match(settings, /<AdjusterControl \/>/)

// No separate app, no sixteenth agent, no new top-level nav entry.
assert.equal(existsSync(new URL('../app/jarvis/page.tsx', import.meta.url)), false)
assert.doesNotMatch(nav, /jarvis|adjuster/i)
assert.match(agents, /AGENT_TOGGLES: AgentToggleInfo\[\] = \[/)
const toggleBlock = agents.slice(agents.indexOf('AGENT_TOGGLES'), agents.indexOf('const AGENT_KEYS'))
assert.equal((toggleBlock.match(/agentKey:/g) ?? []).length, 4, 'the four managed switches are unchanged')

console.log('jarvis-adjuster UI contract passed')
