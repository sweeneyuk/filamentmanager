// Quote maths, moved unchanged from Calculator.jsx (except bug 2 in buildSpoolData).
import { quoteSpoolCost } from './spools.js';

const findSpool = (spools, id) => (id === undefined || id === null || id === ''
  ? null
  : spools.find((s) => s.id === parseInt(id, 10)) || null);

export function quoteTotals({ weights, selected, spools, printTimeSeconds, quantity, labourMinutes, settings, dynamicRate }) {
  const printHours = ((Number(printTimeSeconds) || 0) / 3600) * quantity;

  let materialCost = 0;
  (weights || []).forEach((w, i) => {
    const spool = findSpool(spools, selected?.[i]);
    if (spool && spool.cost && spool.total_weight) {
      materialCost += (spool.cost / spool.total_weight) * (w.weight || 0) * quantity;
    }
  });

  const machineCost = printHours * (parseFloat(settings.calc_wear_rate) || 0);
  const kwhUsed = ((parseFloat(settings.calc_avg_wattage) || 150) * printHours) / 1000;
  let energyRate = parseFloat(settings.calc_energy_rate) || 0;
  if (settings.energy_rate_source === 'ha' && dynamicRate !== null && dynamicRate !== undefined) {
    energyRate = parseFloat(dynamicRate);
  }
  const energyCost = kwhUsed * energyRate;
  const labourCost = ((labourMinutes * quantity) / 60) * (parseFloat(settings.calc_labor_rate) || 0);
  const totalCost = materialCost + machineCost + energyCost + labourCost;
  const markupAmount = totalCost * ((parseFloat(settings.calc_markup) || 0) / 100);
  return { printHours, materialCost, machineCost, energyCost, labourCost, totalCost, markupAmount, finalPrice: totalCost + markupAmount };
}

export function buildSpoolData(weights, selected, spools, quantity) {
  return (weights || []).map((w, i) => {
    const spool = findSpool(spools, selected?.[i]);
    return {
      slot: i + 1,
      weight: (w.weight || 0) * quantity,
      spool_id: spool ? spool.id : null,
      spool_name: spool ? `${spool.brand_name} ${spool.material_name} ${spool.color_name || ''}`.trim() : 'Unknown',
      cost: spool ? quoteSpoolCost(w.weight || 0, quantity, spool) : 0,
    };
  });
}
