import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nozzleReadings, chamberReading, fanReadings } from './temperature.js'

test('dual nozzle decoding is unchanged', () => {
  assert.deepEqual(nozzleReadings({ raw: { device: { extruder: { info: [
    { id: 0, temp: (220 << 16) | 215 }, { id: 1, temp: 35 }] } } } }),
  [{ label: 'Left nozzle', temp: 35, target: 0 }, { label: 'Right nozzle', temp: 215, target: 220 }])
})
test('dual nozzle falls back to nozzle_target_temper', () => {
  assert.deepEqual(nozzleReadings({ raw: { nozzle_target_temper: 210, device: { extruder: { info: [
    { id: 0, temp: 200, htar: 0 }, { id: 1, temp: 30, htar: 250 }] } } } }),
  [{ label: 'Left nozzle', temp: 30, target: 250 }, { label: 'Right nozzle', temp: 200, target: 210 }])
})
test('single nozzle', () => {
  assert.deepEqual(nozzleReadings({}), [{ label: 'Nozzle', temp: 0, target: 0 }])
  assert.deepEqual(nozzleReadings({ nozzleTemp: 215, nozzleTarget: 220 }), [{ label: 'Nozzle', temp: 215, target: 220 }])
})
test('chamber decoding', () => {
  assert.deepEqual(chamberReading({ chamberTemp: (50 << 16) | 35 }), { temp: 35, target: 50 })
  assert.deepEqual(chamberReading({ chamberTemp: 12835 }), { temp: 35, target: 50 })
  assert.deepEqual(chamberReading({ chamberTemp: 35000 }), { temp: 35, target: 0 })
  assert.deepEqual(chamberReading({ chamberTemp: 38 }), { temp: 38, target: 0 })
  assert.deepEqual(chamberReading({}), { temp: 0, target: 0 })
})
test('fans', () => {
  const fans = fanReadings({ cooling_fan_speed: '15', heatbreak_fan_speed: '0', big_fan1_speed: '7' })
  assert.deepEqual(fans.map((f) => f.label), ['Part', 'Hotend', 'Aux', 'Chamber'])
  assert.equal(fans[0].percent, 100)
  assert.equal(fans[1].percent, 0)
  assert.equal(fans[2].percent, 47)
  assert.equal(fans[3].percent, 0)
  assert.deepEqual(fanReadings(undefined).map((f) => f.percent), [null, null, null, null])
})
