import { colorName } from '../../lib/colors.js';
import { remainingGrams, remainingFraction, stockState, restockUrl } from '../../lib/spools.js';
import { spoolLocation } from '../../lib/ams.js';

export const COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'created_at', label: 'Added' },
  { key: 'last_used_at', label: 'Last used' },
  { key: 'color', label: 'Colour' },
  { key: 'material_name', label: 'Material' },
  { key: 'subtype', label: 'Subtype' },
  { key: 'brand_name', label: 'Brand' },
  { key: 'location', label: 'Location', sortable: false },
  { key: 'total_weight', label: 'Net' },
  { key: 'cost', label: 'Cost' },
  { key: 'remaining', label: 'Remaining' },
];

const date = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : null;
};

export function spoolView(spool, ctx) {
  const stock = stockState(spool, ctx.threshold);
  const url = restockUrl(spool, ctx.settings);
  return {
    spool,
    id: spool.id,
    title: [spool.brand_name, spool.material_name].filter(Boolean).join(' ') || `Spool ${spool.id}`,
    subtype: spool.subtype || 'Basic',
    colour: colorName(spool),
    grams: Math.round(remainingGrams(spool)),
    fraction: remainingFraction(spool),
    stock,
    location: spoolLocation(spool.id, ctx) || spool.location || null,
    added: date(spool.created_at) || '–',
    lastUsed: date(spool.last_used_at) || 'Never',
    restock: url && stock !== 'ok' ? url : null,
    archived: Boolean(spool.archived),
  };
}

export const barTone = (stock) => (stock === 'out' ? 'danger' : stock === 'low' ? 'warning' : 'accent');
