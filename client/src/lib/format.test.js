import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatMoney, formatMinutes, currencySymbol, formatDuration, finishTime } from './format.js'

test('formatMoney uses GBP and en-GB', () => {
  assert.equal(formatMoney(4.5), '£4.50')
  assert.equal(formatMoney(2, 'USD'), 'US$2.00')
})
test('formatMoney treats missing or non-finite values as 0', () => {
  assert.equal(formatMoney(undefined), '£0.00')
  assert.equal(formatMoney(null), '£0.00')
  assert.equal(formatMoney('abc'), '£0.00')
  assert.equal(formatMoney('3.2'), '£3.20')
})
test('formatMoney falls back to GBP for empty or invalid codes', () => {
  assert.equal(formatMoney(2, ''), '£2.00')
  assert.equal(formatMoney(2, 'pounds'), '£2.00')
  assert.equal(formatMoney(2, null), '£2.00')
})
test('currencySymbol', () => {
  assert.equal(currencySymbol(), '£')
  assert.equal(currencySymbol('pounds'), '£')
  assert.equal(currencySymbol('USD'), 'US$')
})
test('formatMinutes', () => {
  assert.equal(formatMinutes(125), '2h 5m')
  assert.equal(formatMinutes(45), '45m')
  assert.equal(formatMinutes(undefined), '0m')
})
test('formatDuration matches the old Archive helper', () => {
  assert.equal(formatDuration(0), '0s')
  assert.equal(formatDuration(3725), '1h 2m')
  assert.equal(formatDuration(125), '2m 5s')
  assert.equal(formatDuration(42), '42s')
})
test('finishTime', () => {
  assert.equal(finishTime(125, new Date(2026, 10, 26, 12, 0)), '14:05')
  assert.equal(finishTime(125, new Date(2026, 10, 26, 22, 0)), 'Fri 00:05')
})
