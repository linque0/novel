#!/usr/bin/env node
/**
 * Pure unit verification for src/services/lore-nav-tree.js
 * Covers piecewise indent, cap, guide-line geometry, and smart collapse logic.
 */
import assert from 'node:assert/strict'
import {
  LORE_NAV_COMPACT_CAP,
  LORE_NAV_WIDE_CAP,
  loreNavDepthCap,
  loreNavIndentPx,
  loreNavGuideX,
  loreNavCollapseIds,
} from '../src/services/lore-nav-tree.js'

let passed = 0
function test(name, fn) {
  fn()
  passed++
  console.log(`  PASS: ${name}`)
}

console.log('[lore-nav-tree-unit-verify] Running unit tests...')

test('compact indent follows 0 / +10 (1..3) / +6 (4..6) / cap 48 (7+)', () => {
  assert.equal(LORE_NAV_COMPACT_CAP, 48)
  assert.equal(loreNavDepthCap(false), 6)
  const expected = [0, 10, 20, 30, 36, 42, 48, 48, 48, 48, 48]
  for (let d = 0; d < expected.length; d++) {
    assert.equal(loreNavIndentPx(d), expected[d], `depth ${d}`)
  }
  assert.equal(loreNavIndentPx(-2), 0)
  assert.equal(loreNavIndentPx(NaN), 0)
})

test('wide indent follows 0 / +12 (1..4) / +8 (5..7) / cap 72 (8+)', () => {
  assert.equal(LORE_NAV_WIDE_CAP, 72)
  assert.equal(loreNavDepthCap(true), 7)
  const expected = [0, 12, 24, 36, 48, 56, 64, 72, 72, 72, 72]
  for (let d = 0; d < expected.length; d++) {
    assert.equal(loreNavIndentPx(d, { wide: true }), expected[d], `wide depth ${d}`)
  }
})

test('compact guideX stays strictly between parent indent and child indent and stops at cap', () => {
  const seen = new Set()
  for (let d = 0; d <= 5; d++) {
    const gx = loreNavGuideX(d)
    const cur = loreNavIndentPx(d)
    const next = loreNavIndentPx(d + 1)
    assert.equal(typeof gx, 'number', `depth ${d} should have numeric guideX`)
    assert.ok(gx > cur && gx < next, `depth ${d}: guideX ${gx} must lie in (${cur}, ${next})`)
    assert.ok(!seen.has(gx), `depth ${d}: guideX ${gx} must be unique`)
    seen.add(gx)
  }
  for (let d = 6; d <= 10; d++) {
    assert.equal(loreNavGuideX(d), null, `depth ${d} at/past cap must return null to avoid overlapping lines`)
  }
})

test('wide guideX stays strictly between parent and child indents and stops at cap', () => {
  const seen = new Set()
  for (let d = 0; d <= 6; d++) {
    const gx = loreNavGuideX(d, { wide: true })
    const cur = loreNavIndentPx(d, { wide: true })
    const next = loreNavIndentPx(d + 1, { wide: true })
    assert.equal(typeof gx, 'number', `wide depth ${d} should have numeric guideX`)
    assert.ok(gx > cur && gx < next, `wide depth ${d}: guideX ${gx} must lie in (${cur}, ${next})`)
    assert.ok(!seen.has(gx), `wide depth ${d}: guideX ${gx} must be unique`)
    seen.add(gx)
  }
  for (let d = 7; d <= 10; d++) {
    assert.equal(loreNavGuideX(d, { wide: true }), null, `wide depth ${d} at/past cap must return null`)
  }
})

test('loreNavCollapseIds first collapses unrelated branches, then collapses all on second click', () => {
  // Tree:
  // r1 -> a1 -> a1_1 (leaf)
  //    -> a2 -> a2_1 (leaf)
  // r2 -> b1 (leaf)
  const nodes = [
    { id: 'r1', parentId: null },
    { id: 'a1', parentId: 'r1' },
    { id: 'a1_1', parentId: 'a1' },
    { id: 'a2', parentId: 'r1' },
    { id: 'a2_1', parentId: 'a2' },
    { id: 'r2', parentId: null },
    { id: 'b1', parentId: 'r2' },
  ]
  const childrenOf = (id) => nodes.filter((n) => n.parentId === id)
  const activePath = ['r1', 'a1', 'a1_1']

  // Step 1: all expanded -> collapse unrelated branches (a2, r2), keep active path (r1, a1) open
  const first = loreNavCollapseIds(nodes, childrenOf, activePath, [])
  assert.deepEqual(first.sort(), ['a2', 'r2'])

  // Step 2: only active path open -> collapse ALL parents (r1, a1, a2, r2)
  const second = loreNavCollapseIds(nodes, childrenOf, activePath, first)
  assert.deepEqual(second.sort(), ['a1', 'a2', 'r1', 'r2'])
})

test('loreNavCollapseIds with no active path collapses all parents immediately', () => {
  const nodes = [
    { id: 'r1', parentId: null },
    { id: 'c1', parentId: 'r1' },
    { id: 'r2', parentId: null },
    { id: 'c2', parentId: 'r2' },
  ]
  const childrenOf = (id) => nodes.filter((n) => n.parentId === id)
  const res = loreNavCollapseIds(nodes, childrenOf, [], [])
  assert.deepEqual(res.sort(), ['r1', 'r2'])
})

test('loreNavCollapseIds respects pinOpenIds (e.g. hoisted root stays open)', () => {
  const nodes = [
    { id: 'h', parentId: null },
    { id: 'c1', parentId: 'h' },
    { id: 'g1', parentId: 'c1' },
    { id: 'c2', parentId: 'h' },
    { id: 'g2', parentId: 'c2' },
  ]
  const childrenOf = (id) => nodes.filter((n) => n.parentId === id)
  const first = loreNavCollapseIds(nodes, childrenOf, ['h', 'c1', 'g1'], [], { pinOpenIds: ['h'] })
  assert.deepEqual(first.sort(), ['c2'])
  const second = loreNavCollapseIds(nodes, childrenOf, ['h', 'c1', 'g1'], first, { pinOpenIds: ['h'] })
  assert.deepEqual(second.sort(), ['c1', 'c2'])
})

console.log(`[lore-nav-tree-unit-verify] All ${passed} tests passed!`)
