import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summariseAnalytics } from './analytics.js'

const row = (o) => ({ id: 1, total_cost: 1, energy_cost: 0.2, filament_cost: 0.8, filament_used_g: 50, ...o })

test('two rows of one print count its cost once and split weight per spool', () => {
  const s = summariseAnalytics([
    row({ material: 'PLA', spool_weight_used_g: 30 }),
    row({ material: 'PETG', spool_weight_used_g: 20 }),
  ])
  assert.equal(s.totalPrints, 1)
  assert.equal(s.totalCost, 1)
  assert.equal(s.totalEnergyCost, 0.2)
  assert.equal(s.totalFilamentCost, 0.8)
  assert.equal(s.totalWeightG, 50)
  assert.deepEqual(s.materials, [{ name: 'PLA', grams: 30 }, { name: 'PETG', grams: 20 }])
})

test('rows without a per-spool weight use the print weight once', () => {
  const s = summariseAnalytics([row({ material: 'PLA', spool_weight_used_g: null }), row({ material: 'PLA', spool_weight_used_g: null })])
  assert.deepEqual(s.materials, [{ name: 'PLA', grams: 50 }])
})

test('failure rate per spool', () => {
  const s = summariseAnalytics([
    row({ id: 1, brand: 'Bambu', material: 'PLA', color: '#000000', ai_analysis: '{"status":"SUCCESS"}' }),
    row({ id: 2, brand: 'Bambu', material: 'PLA', color: '#000000', ai_analysis: '{"status":"SPAGHETTI"}' }),
  ])
  assert.equal(s.success, 1)
  assert.equal(s.failure, 1)
  assert.deepEqual(s.failureTypes, [{ name: 'SPAGHETTI', count: 1 }])
  assert.deepEqual(s.problemSpools, [{ key: 'Bambu PLA::#000000', name: 'Bambu PLA', color: '#000000', fails: 1, total: 2, rate: 50 }])
})

test('bad ai_analysis JSON is ignored', () => {
  const s = summariseAnalytics([row({ ai_analysis: '{oops' })])
  assert.equal(s.success, 0)
  assert.equal(s.failure, 0)
  assert.equal(s.totalPrints, 1)
})

test('empty input', () => {
  const s = summariseAnalytics([])
  assert.equal(s.totalPrints, 0)
  assert.deepEqual(s.materials, [])
})
