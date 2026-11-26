import { test } from 'node:test'
import assert from 'node:assert/strict'
import { quoteTotals, buildSpoolData } from './quote.js'

const spools = [
  { id: 1, brand_name: 'Bambu Lab', material_name: 'PLA', color_name: 'Dark Red', cost: 20, total_weight: 1000 },
  { id: 2, brand_name: 'Bambu Lab', material_name: 'PLA', color_name: 'Black', cost: 30, total_weight: 500 },
]
const weights = [{ weight: 50, hex: '#112233' }, { weight: 20, hex: '#ffffff' }]
const settings = { calc_wear_rate: '0.5', calc_labor_rate: '12', calc_markup: '50', calc_avg_wattage: '150', calc_energy_rate: '0.25', energy_rate_source: 'manual' }
const base = { weights, selected: { 0: 1, 1: 2 }, spools, printTimeSeconds: 7200, quantity: 1, labourMinutes: 15, settings, dynamicRate: null }
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('quote totals match the old formulas', () => {
  const q = quoteTotals(base)
  close(q.printHours, 2)
  close(q.materialCost, 2.2)
  close(q.machineCost, 1)
  close(q.energyCost, 0.075)
  close(q.labourCost, 3)
  close(q.totalCost, 6.275)
  close(q.markupAmount, 3.1375)
  close(q.finalPrice, 9.4125)
})

test('Home Assistant rate replaces the manual rate', () => {
  close(quoteTotals({ ...base, settings: { ...settings, energy_rate_source: 'ha' }, dynamicRate: 0.5 }).energyCost, 0.15)
  close(quoteTotals({ ...base, settings: { ...settings, energy_rate_source: 'ha' }, dynamicRate: null }).energyCost, 0.075)
})

test('quantity multiplies time, material and labour', () => {
  const q = quoteTotals({ ...base, quantity: 2 })
  close(q.printHours, 4)
  close(q.materialCost, 4.4)
  close(q.labourCost, 6)
})

test('nothing parsed gives zeros', () => {
  const q = quoteTotals({ ...base, weights: [], printTimeSeconds: 0, labourMinutes: 0 })
  close(q.finalPrice, 0)
})

test('saved spool cost uses the spool price per gram (bug 2)', () => {
  const data = buildSpoolData(weights, { 0: 1, 1: 2 }, spools, 1)
  assert.deepEqual(data[0], { slot: 1, weight: 50, spool_id: 1, spool_name: 'Bambu Lab PLA Dark Red', cost: 1 })
  close(data[1].cost, 1.2)
  assert.deepEqual(buildSpoolData(weights, {}, spools, 1)[0], { slot: 1, weight: 50, spool_id: null, spool_name: 'Unknown', cost: 0 })
  close(buildSpoolData(weights, { 1: '2' }, spools, 3)[1].cost, 3.6)
  assert.equal(buildSpoolData(weights, { 1: '2' }, spools, 3)[1].weight, 60)
})
