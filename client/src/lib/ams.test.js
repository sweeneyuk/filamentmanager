import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unitName, slotNumber, trayKey, humidityLabel, isEmptyHolder, slotView, spoolLocation } from './ams.js'

test('unitName', () => {
  assert.equal(unitName({}, 1, '0'), 'AMS 1')
  assert.equal(unitName({ ams_name_1_0: 'AMS 2 Pro' }, 1, '0'), 'AMS 2 Pro')
  assert.equal(unitName({}, 1, '254'), 'External Spool')
})
test('slot numbers and keys', () => {
  assert.equal(slotNumber('0', 3), 4)
  assert.equal(slotNumber('128', 0), 1)
  assert.equal(trayKey('0', 2), '0-2')
})
test('humidityLabel', () => {
  assert.equal(humidityLabel({ humidity: '1' }), '> 50%')
  assert.equal(humidityLabel({ humidity: '4' }), '20-30%')
  assert.equal(humidityLabel({ humidity_raw: 33, humidity: '1' }), '33%')
  assert.equal(humidityLabel({ humidity: '7' }), '7%')
  assert.equal(humidityLabel({}), null)
})
test('isEmptyHolder', () => {
  assert.equal(isEmptyHolder({ id: '128', tray: [{}] }, {}), false)
  assert.equal(isEmptyHolder({ id: '254', tray: [{ tray_type: '' }] }, {}), true)
  assert.equal(isEmptyHolder({ id: '254', tray: [{ tray_type: 'PLA' }] }, {}), false)
  assert.equal(isEmptyHolder({ id: '255', tray: [{}] }, { '255-0': 3 }), false)
})

const spools = [
  { id: 1, total_weight: 1000, used_weight: 309, material_name: 'PLA', color: '#9d2235' },
  { id: 3, total_weight: 1000, used_weight: 950, material_name: 'PLA', color: '#ffffff' },
]
const unit = { id: '0', tray: [{ tray_type: 'PLA', tray_color: 'FFFFFFFF' }, { tray_type: 'PETG', tray_color: '3366CCFF' }, { tray_type: '' }, { tray_type: 'PLA', tray_color: '9D2235FF' }] }
const ctx = { assignments: { '0-0': 3, '0-1': 999, '0-3': 1 }, spools, state: { currentTrayId: '0-3', activeTrays: ['0-3', '0-0'] }, threshold: 200 }

test('slotView assigned, feeding', () => {
  const v = slotView(unit, 3, ctx)
  assert.equal(v.key, '0-3'); assert.equal(v.number, 4); assert.equal(v.kind, 'assigned')
  assert.equal(v.spool.id, 1); assert.equal(v.grams, 691); assert.equal(v.fraction, 0.691)
  assert.equal(v.material, 'PLA'); assert.equal(v.hex, '#9d2235'); assert.equal(v.feeding, true)
  assert.equal(v.inUse, true); assert.equal(v.stock, 'ok'); assert.equal(v.hasAssignment, true)
})
test('slotView low stock in use but not feeding', () => {
  const v = slotView(unit, 0, ctx)
  assert.equal(v.stock, 'low'); assert.equal(v.feeding, false); assert.equal(v.inUse, true)
})
test('slotView assigned to a missing spool is unassigned but clearable', () => {
  const v = slotView(unit, 1, ctx)
  assert.equal(v.kind, 'unassigned'); assert.equal(v.spool, null); assert.equal(v.hasAssignment, true)
  assert.equal(v.material, 'PETG'); assert.equal(v.hex, '#3366cc'); assert.equal(v.grams, 0); assert.equal(v.stock, null)
})
test('slotView empty', () => {
  const v = slotView(unit, 2, { ...ctx, state: null })
  assert.equal(v.kind, 'empty'); assert.equal(v.hasAssignment, false); assert.equal(v.feeding, false); assert.equal(v.inUse, false)
})
test('spoolLocation', () => {
  const printers = [{ id: 1, name: 'X2D' }]
  assert.equal(spoolLocation(1, { assignments: { 1: { '0-3': 1 } }, printers, settings: {} }), 'X2D - AMS 1 Slot 4')
  assert.equal(spoolLocation(1, { assignments: { 1: { '0-3': 1 } }, printers, settings: { ams_name_1_0: 'Pro' } }), 'X2D - Pro - Slot 4')
  assert.equal(spoolLocation(1, { assignments: { 1: { '254-0': 1 } }, printers, settings: {} }), 'X2D - External Spool')
  assert.equal(spoolLocation(2, { assignments: { 1: { '0-3': 1 } }, printers, settings: {} }), null)
  assert.equal(spoolLocation(1, { assignments: { 7: { '0-0': 1 } }, printers, settings: {} }), 'Printer 7 - AMS 1 Slot 1')
})
