import { test } from 'node:test'
import assert from 'node:assert/strict'
import { printPhase, predictedTotal, latestTakeover } from './printState.js'

test('printPhase', () => {
  assert.deepEqual(printPhase({ status: 'PREPARE' }), { id: 'preparing', label: 'Preparing', active: true })
  assert.deepEqual(printPhase({ status: 'RUNNING' }), { id: 'printing', label: 'Printing', active: true })
  assert.equal(printPhase({ status: 'PAUSE' }).active, true)
  assert.equal(printPhase({ status: 'PAUSE' }).label, 'Paused')
  assert.deepEqual(printPhase({ status: 'FINISH' }), { id: 'finished', label: 'Finished', active: false })
  assert.deepEqual(printPhase({ status: 'FAILED' }), { id: 'failed', label: 'Failed', active: false })
  assert.deepEqual(printPhase({ status: 'IDLE' }), { id: 'idle', label: 'Idle', active: false })
  assert.deepEqual(printPhase(undefined), { id: 'idle', label: 'Idle', active: false })
  assert.deepEqual(printPhase({ status: 'SLICING' }), { id: 'other', label: 'SLICING', active: false })
})
test('predictedTotal', () => {
  assert.equal(predictedTotal({}), null)
  assert.equal(predictedTotal({ slicerFilaments: [{ used_g: 0 }] }), null)
  assert.equal(predictedTotal({ slicerFilaments: [{ used_g: 49.1 }, { used_g: '0.9' }, {}] }), 50)
})
test('latestTakeover ignores external tray 255', () => {
  assert.equal(latestTakeover({}), null)
  const t1 = { fromTray: '0-0', toTray: '0-3', progress: 40 }
  assert.deepEqual(latestTakeover({ takeovers: [t1, { fromTray: '255-0', toTray: '0-1' }] }), t1)
})
