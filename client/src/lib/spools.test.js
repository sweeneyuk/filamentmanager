import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  remainingGrams, remainingFraction, lowStockThreshold, stockState, filterSpools, sortSpools,
  loadSortConfig, loadViewMode, materialTotals, scrapSpools, restockUrl, quoteSpoolCost,
} from './spools.js'

const s = (id, total, used, extra = {}) => ({ id, total_weight: total, used_weight: used, ...extra })

test('remaining grams and fraction', () => {
  assert.equal(remainingGrams({ total_weight: 1000, used_weight: 309 }), 691)
  assert.equal(remainingGrams({ total_weight: 1000, used_weight: 1200 }), 0)
  assert.equal(remainingGrams({}), 0)
  assert.equal(remainingFraction({ total_weight: 0, used_weight: 0 }), 0)
  assert.equal(remainingFraction({ used_weight: 0 }), 0)
  assert.equal(remainingFraction({ total_weight: 500, used_weight: 100 }), 0.8)
  assert.equal(remainingFraction({ total_weight: 500, used_weight: 900 }), 0)
})
test('lowStockThreshold', () => {
  assert.equal(lowStockThreshold({ low_stock_threshold: 'abc' }), 200)
  assert.equal(lowStockThreshold({}), 200)
  assert.equal(lowStockThreshold(undefined), 200)
  assert.equal(lowStockThreshold({ low_stock_threshold: '150' }), 150)
})
test('stockState', () => {
  assert.equal(stockState({ total_weight: 1000, used_weight: 850 }, 200), 'low')
  assert.equal(stockState({ total_weight: 1000, used_weight: 1000 }, 200), 'out')
  assert.equal(stockState({ total_weight: 1000, used_weight: 800 }, 200), 'ok')
})
test('filterSpools', () => {
  const list = [s(1, 1000, 0), s(2, 1000, 900), s(3, 1000, 100, { archived: 1 }), s(4, 1000, 1000)]
  const ids = (f) => filterSpools(list, f, 200).map((x) => x.id)
  assert.deepEqual(ids('Active'), [1, 2, 4])
  assert.deepEqual(ids('Archived'), [3])
  assert.deepEqual(ids('All'), [1, 2, 3, 4])
  assert.deepEqual(ids('Used'), [2, 4])
  assert.deepEqual(ids('New'), [1])
  assert.deepEqual(ids('Low Stock'), [2, 4])
})
test('sortSpools', () => {
  const list = [s(1, 1000, 500, { brand_name: 'b' }), s(2, 1000, 100, { brand_name: 'A' }), s(3, 1000, 900, { brand_name: null })]
  assert.deepEqual(sortSpools(list, { key: 'remaining', direction: 'asc' }).map((x) => x.id), [3, 1, 2])
  assert.deepEqual(sortSpools(list, { key: 'id', direction: 'desc' }).map((x) => x.id), [3, 2, 1])
  assert.deepEqual(sortSpools(list, { key: 'brand_name', direction: 'asc' }).map((x) => x.id), [3, 2, 1])
})
test('loadSortConfig and loadViewMode survive bad storage', () => {
  assert.deepEqual(loadSortConfig('{oops'), { key: 'id', direction: 'desc' })
  assert.deepEqual(loadSortConfig(null), { key: 'id', direction: 'desc' })
  assert.deepEqual(loadSortConfig('"x"'), { key: 'id', direction: 'desc' })
  assert.deepEqual(loadSortConfig('{"key":"remaining","direction":"sideways"}'), { key: 'remaining', direction: 'desc' })
  assert.deepEqual(loadSortConfig('{"key":"remaining","direction":"asc"}'), { key: 'remaining', direction: 'asc' })
  assert.equal(loadViewMode('x'), 'table')
  assert.equal(loadViewMode(null), 'table')
  assert.equal(loadViewMode('grid'), 'grid')
})
test('materialTotals', () => {
  assert.deepEqual(materialTotals([s(1, 1000, 0, { material_name: 'PLA' }), s(2, 500, 100, { material_name: 'PLA' }), s(3, 100, 0)]),
    [{ material: 'PLA', grams: 1400 }, { material: 'Unknown', grams: 100 }])
})
test('scrapSpools keeps 0 < left < 100', () => {
  assert.deepEqual(scrapSpools([s(1, 1000, 950), s(2, 1000, 1000), s(3, 1000, 900), s(4, 1000, 940)]).map((x) => x.id), [1, 4])
})
test('restockUrl', () => {
  assert.equal(restockUrl({}, {}), null)
  assert.equal(restockUrl({ shopify_variant_id: 'https://x.test/p' }, {}), 'https://x.test/p')
  assert.equal(restockUrl({ shopify_variant_id: '123', material_name: 'PLA' }, {}),
    'https://uk.store.bambulab.com/products/pla-basic-filament?variant=123')
  assert.equal(restockUrl({ shopify_variant_id: '9', material_name: 'PETG', subtype: 'HF' }, { bambu_store_region: 'https://us.store.bambulab.com' }),
    'https://us.store.bambulab.com/products/petg-hf?variant=9')
})
test('quoteSpoolCost', () => {
  assert.equal(quoteSpoolCost(50, 2, { cost: 20, total_weight: 500 }), 4)
  assert.equal(quoteSpoolCost(50, 2, { cost: 20 }), 0)
  assert.equal(quoteSpoolCost(50, 1, null), 0)
})
