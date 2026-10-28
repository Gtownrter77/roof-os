#!/usr/bin/env node
// God Mode — disabled by default. Owner-only activation.
// Never activates from skill load alone.
// Requires: ENV=SANDBOX, is_owner verified, audit record emitted.
// If not owner, exits with error.
console.log('GOD MODE: disabled by design. Load .agents/skills/god-mode.md only for spec, not activation.')
console.log('To activate: set ENV=SANDBOX, verify is_system_owner, run with explicit approval.')
process.exit(1)
