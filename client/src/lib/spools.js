// Spool weights, stock and list logic. Moved from FilamentManager.jsx.

export const DEFAULT_SORT = { key: 'id', direction: 'desc' };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function remainingGrams(spool) {
  if (!spool) return 0;
  return Math.max(0, num(spool.total_weight) - num(spool.used_weight));
}

export function remainingFraction(spool) {
  const total = num(spool?.total_weight);
  if (total <= 0) return 0;
  return Math.min(1, remainingGrams(spool) / total);
}

export function lowStockThreshold(settings) {
  const n = parseInt(settings?.low_stock_threshold, 10);
  return Number.isFinite(n) ? n : 200;
}

export function stockState(spool, threshold) {
  const left = num(spool?.total_weight) - num(spool?.used_weight);
  if (left <= 0) return 'out';
  if (left < threshold) return 'low';
  return 'ok';
}

const isLow = (s, threshold) => num(s.total_weight) - num(s.used_weight) < threshold;

export function filterSpools(spools, filter, threshold) {
  const list = spools || [];
  switch (filter) {
    case 'Active': return list.filter((s) => !s.archived);
    case 'Archived': return list.filter((s) => s.archived);
    case 'Used': return list.filter((s) => !s.archived && s.used_weight > 0);
    case 'New': return list.filter((s) => !s.archived && s.used_weight === 0);
    case 'Low Stock': return list.filter((s) => !s.archived && isLow(s, threshold));
    default: return list;
  }
}

export function sortSpools(spools, { key, direction }) {
  const value = (s) => {
    if (key === 'remaining') return s.total_weight - s.used_weight;
    if (key === 'cost') return s.cost || 0;
    if (key === 'last_used_at') return s.last_used_at ? new Date(s.last_used_at).getTime() : 0;
    if (key === 'created_at') return new Date(s.created_at).getTime();
    return s[key];
  };
  return [...(spools || [])].sort((a, b) => {
    let aVal = value(a);
    let bVal = value(b);
    if (aVal === undefined || aVal === null) aVal = '';
    if (bVal === undefined || bVal === null) bVal = '';
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function loadSortConfig(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.key !== 'string' || !parsed.key) return { ...DEFAULT_SORT };
    return { key: parsed.key, direction: parsed.direction === 'asc' ? 'asc' : 'desc' };
  } catch {
    return { ...DEFAULT_SORT };
  }
}

export function loadViewMode(raw) {
  return raw === 'grid' ? 'grid' : 'table';
}

export function materialTotals(spools) {
  const totals = new Map();
  for (const s of spools || []) {
    const name = s.material_name || 'Unknown';
    totals.set(name, (totals.get(name) || 0) + (num(s.total_weight) - num(s.used_weight)));
  }
  return [...totals].map(([material, grams]) => ({ material, grams }));
}

export function scrapSpools(spools) {
  return (spools || []).filter((s) => {
    const left = s.total_weight - s.used_weight;
    return left < 100 && left > 0;
  });
}

// Unchanged from FilamentManager.getBambuProductUrl.
export function restockUrl(spool, settings) {
  if (!spool?.shopify_variant_id) return null;
  const id = String(spool.shopify_variant_id);
  if (id.startsWith('http')) return id;
  const baseUrl = settings?.bambu_store_region || 'https://uk.store.bambulab.com';
  const mat = (spool.material_name || '').toLowerCase();
  const sub = (spool.subtype || 'basic').toLowerCase();
  let slug = `${mat}-${sub}`;
  if (slug === 'pla-basic') slug = 'pla-basic-filament';
  return `${baseUrl}/products/${slug}?variant=${id}`;
}

export function quoteSpoolCost(weightG, quantity, spool) {
  const cost = num(spool?.cost);
  const total = num(spool?.total_weight);
  if (!cost || total <= 0) return 0;
  return (num(weightG) * num(quantity) * cost) / total;
}
