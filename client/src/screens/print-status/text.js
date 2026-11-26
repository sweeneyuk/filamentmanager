import { fanReadings } from '../../lib/temperature.js';
import { colorName } from '../../lib/colors.js';
import { unitName, slotNumber } from '../../lib/ams.js';

export function fanLine(state) {
  const parts = fanReadings(state?.raw).map((f, i) => {
    const name = `${i === 0 ? f.label : f.label.toLowerCase()} fan`;
    return `${name} ${f.percent ? `${f.percent}%` : 'off'}`;
  });
  parts.push(`light ${state?.light ? 'on' : 'off'}`);
  return parts.join(', ');
}

export function materialLine({ state, printerId, assignments, spools, settings }) {
  const trayId = state?.currentTrayId;
  if (!trayId || typeof trayId !== 'string' || !trayId.includes('-')) return null;
  const [unitId, index] = trayId.split('-');
  const spoolId = assignments?.[trayId];
  const spool = spoolId != null ? spools.find((s) => s.id == spoolId) : null; // eslint-disable-line eqeqeq
  const where = `from ${unitName(settings, printerId, unitId)} slot ${slotNumber(unitId, parseInt(index, 10) || 0)}`;
  if (!spool) return where.charAt(0).toUpperCase() + where.slice(1);
  const name = [spool.brand_name, spool.material_name, spool.subtype && spool.subtype.toLowerCase() !== 'basic' ? spool.subtype : null]
    .filter(Boolean).join(' ');
  const colour = colorName(spool);
  return [name, colour !== 'Unknown' ? colour.toLowerCase() : null, where].filter(Boolean).join(', ');
}


export function slotLabel(view) {
  if (view.kind === 'empty') return `Slot ${view.number}, empty`;
  if (view.kind === 'unassigned') return `Slot ${view.number}, not assigned`;
  const parts = [`Slot ${view.number}`];
  if (view.material) parts.push(view.material);
  parts.push(`${Math.round(view.grams)} grams left`);
  if (view.stock === 'low') parts.push('low stock');
  if (view.stock === 'out') parts.push('ran out');
  if (view.feeding) parts.push('feeding');
  else if (view.inUse) parts.push('in use');
  return parts.join(', ');
}
