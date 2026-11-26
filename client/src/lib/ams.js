// AMS unit and slot logic. Moved from PrintStatus.jsx and FilamentManager.jsx.
import { remainingGrams, remainingFraction, stockState } from './spools.js';
import { trayHex } from './colors.js';

const EXTERNAL = ['128', '254', '255'];
export const isExternal = (unitId) => EXTERNAL.includes(String(unitId));

export function unitName(settings, printerId, unitId) {
  const custom = settings?.[`ams_name_${printerId}_${unitId}`];
  if (custom) return custom;
  return isExternal(unitId) ? 'External Spool' : `AMS ${parseInt(unitId, 10) + 1}`;
}

export function slotNumber(unitId, index) {
  return isExternal(unitId) ? 1 : index + 1;
}

export function trayKey(unitId, index) {
  return `${unitId}-${index}`;
}

const HUMIDITY = { 1: '> 50%', 2: '40-50%', 3: '30-40%', 4: '20-30%', 5: '< 20%' };

export function humidityLabel(unit) {
  if (unit?.humidity_raw !== undefined) return `${unit.humidity_raw}%`;
  if (unit?.humidity === undefined) return null;
  return HUMIDITY[unit.humidity] || `${unit.humidity}%`;
}

const hasValue = (v) => v !== undefined && v !== null && v !== '';

export function isEmptyHolder(unit, assignments) {
  if (!['254', '255'].includes(String(unit?.id))) return false;
  const trays = unit.tray || [];
  if (trays.some((t) => t?.tray_type)) return false;
  return !trays.some((_, i) => hasValue(assignments?.[trayKey(unit.id, i)]));
}

export function slotView(unit, index, { assignments, spools, state, threshold }) {
  const key = trayKey(unit.id, index);
  const tray = unit.tray?.[index] || {};
  const assigned = assignments?.[key];
  const hasAssignment = hasValue(assigned);
  const spool = hasAssignment ? (spools || []).find((s) => s.id == assigned) || null : null; // eslint-disable-line eqeqeq
  const hasFilament = Boolean(tray.tray_type);
  return {
    key,
    number: slotNumber(unit.id, index),
    spool,
    grams: spool ? remainingGrams(spool) : 0,
    fraction: spool ? remainingFraction(spool) : 0,
    material: spool?.material_name || tray.tray_type || null,
    hex: spool?.color || trayHex(tray.tray_color),
    hasAssignment,
    kind: spool ? 'assigned' : hasFilament ? 'unassigned' : 'empty',
    feeding: state?.currentTrayId === key,
    inUse: Boolean(state?.activeTrays?.includes(key)),
    stock: spool ? stockState(spool, threshold) : null,
  };
}

// Unchanged from FilamentManager.getAmsLocation.
export function spoolLocation(spoolId, { assignments, printers, settings }) {
  for (const [printerId, trays] of Object.entries(assignments || {})) {
    for (const [trayId, sId] of Object.entries(trays || {})) {
      if (sId == spoolId) { // eslint-disable-line eqeqeq
        const printer = Array.isArray(printers) ? printers.find((p) => String(p.id) === printerId) : null;
        const printerName = printer ? printer.name : `Printer ${printerId}`;
        const parts = trayId.split('-');
        if (parts.length === 2) {
          const amsId = parts[0];
          const slotNum = parseInt(parts[1], 10) + 1;
          const customName = settings?.[`ams_name_${printerId}_${amsId}`] || settings?.[`ams_name_${amsId}`];
          if (customName) return `${printerName} - ${customName} - Slot ${slotNum}`;
          if (isExternal(amsId)) return `${printerName} - External Spool`;
          return `${printerName} - AMS ${parseInt(amsId, 10) + 1} Slot ${slotNum}`;
        }
        return `${printerName} - ${trayId}`;
      }
    }
  }
  return null;
}
