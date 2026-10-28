#!/usr/bin/env node
'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const field = path.resolve(__dirname, '../apps/field')
const manifest = JSON.parse(fs.readFileSync(path.join(field, 'package.json'), 'utf8'))
const lock = JSON.parse(fs.readFileSync(path.join(field, 'package-lock.json'), 'utf8'))
const expected = path.join(field, 'vendor/deepmerge/index.js')
assert.equal(manifest.overrides.deepmerge, 'file:vendor/deepmerge')
assert.equal(lock.packages['node_modules/deepmerge']?.resolved, 'vendor/deepmerge')
assert.equal(lock.packages['node_modules/deepmerge']?.link, true)
assert.equal(lock.packages['vendor/deepmerge']?.version, '4.3.1-roofos.1')
assert.equal(fs.realpathSync(require.resolve('deepmerge', {paths: [field]})), fs.realpathSync(expected), 'runtime must load patched module')
const merge = require(expected)

function assertSafe(value) {
  assert.equal(Object.getPrototypeOf(value), Object.prototype, 'unexpected prototype')
  assert.equal(value.admin, undefined, 'prototype-injected admin')
  assert.equal(value.polluted, undefined, 'prototype-injected polluted')
}
const payload = JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true},"nested":{"__proto__":{"admin":true},"ok":1}}')
const result = merge({}, payload)
assertSafe(result)
assertSafe(result.nested)
assert.equal(result.nested.ok, 1)
assert.equal(Object.prototype.admin, undefined)
assert.equal(Object.prototype.polluted, undefined)

const nullTarget = Object.create(null)
const nullSource = Object.create(null)
Object.defineProperty(nullSource, '__proto__', {value: {admin: true}, enumerable: true})
nullSource.ok = 2
const nullResult = merge(nullTarget, nullSource)
assertSafe(nullResult)
assert.equal(nullResult.ok, 2)

const maliciousTarget = JSON.parse('{"__proto__":{"admin":true},"safe":4}')
const targetResult = merge(maliciousTarget, {ok: 3})
assertSafe(targetResult)
assert.deepEqual({safe: targetResult.safe, ok: targetResult.ok}, {safe: 4, ok: 3})

assert.deepEqual(merge({item: {a: 1}, rows: [1]}, {item: {b: 2}, rows: [2]}),
  {item: {a: 1, b: 2}, rows: [1, 2]})
assert.deepEqual(merge.all([{a: 1}, {b: 2}]), {a: 1, b: 2})
const symbol = Symbol('safe')
assert.equal(merge({[symbol]: 1}, {[symbol]: 2})[symbol], 2)
console.log('Field deepmerge mitigation: PASS (local resolution, lock, prototype poisoning, safe merge)')
