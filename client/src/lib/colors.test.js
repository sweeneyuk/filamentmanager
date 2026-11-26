import { test } from 'node:test'
import assert from 'node:assert/strict'
import { colorName, trayHex } from './colors.js'

test('colorName prefers color_name', () => {
  assert.equal(colorName({ color_name: 'Dark Red', color: '#9d2235' }), 'Dark Red')
})
test('colorName derives a basic name', () => {
  assert.equal(colorName({ color: '#008080' }), 'Teal')
})
test('colorName unknown', () => {
  assert.equal(colorName({}), 'Unknown')
  assert.equal(colorName({ color: 'nonsense' }), 'Unknown')
})
test('trayHex', () => {
  assert.equal(trayHex('9D2235FF'), '#9d2235')
  assert.equal(trayHex(''), null)
  assert.equal(trayHex(undefined), null)
  assert.equal(trayHex('zz'), null)
})
