// Analytics totals, moved unchanged from Analytics.jsx.

export function summariseAnalytics(rows) {
  let totalCost = 0;
  let totalEnergyCost = 0;
  let totalFilamentCost = 0;
  let totalWeightG = 0;
  let success = 0;
  let failure = 0;
  const materials = new Map();
  const failureTypes = new Map();
  const spoolFailures = {};
  const spoolSuccesses = {};
  const seen = new Set();

  for (const print of rows || []) {
    const first = !seen.has(print.id);
    if (first) {
      seen.add(print.id);
      totalCost += print.total_cost || 0;
      totalEnergyCost += print.energy_cost || 0;
      totalFilamentCost += print.filament_cost || 0;
      totalWeightG += print.filament_used_g || 0;
    }

    // Per-spool weight when available, so multi-material prints split accurately.
    if (print.material) {
      const weight = print.spool_weight_used_g !== undefined && print.spool_weight_used_g !== null
        ? print.spool_weight_used_g
        : (first ? print.filament_used_g || 0 : 0);
      materials.set(print.material, (materials.get(print.material) || 0) + weight);
    }

    if (!print.ai_analysis) continue;
    let ai;
    try {
      ai = typeof print.ai_analysis === 'string' ? JSON.parse(print.ai_analysis) : print.ai_analysis;
    } catch {
      continue;
    }
    if (!ai?.status) continue;
    const spoolKey = print.brand && print.material ? `${print.brand} ${print.material}::${print.color || ''}` : null;
    if (ai.status === 'SUCCESS') {
      if (first) success += 1;
      if (spoolKey) spoolSuccesses[spoolKey] = (spoolSuccesses[spoolKey] || 0) + 1;
    } else {
      if (first) {
        failure += 1;
        const name = ai.status.replace('_', ' ');
        failureTypes.set(name, (failureTypes.get(name) || 0) + 1);
      }
      if (spoolKey) spoolFailures[spoolKey] = (spoolFailures[spoolKey] || 0) + 1;
    }
  }

  const problemSpools = Object.entries(spoolFailures).map(([key, fails]) => {
    const total = (spoolSuccesses[key] || 0) + fails;
    const [name, color] = key.split('::');
    return { key, name, color, fails, total, rate: Math.round((fails / total) * 100) };
  }).sort((a, b) => b.rate - a.rate).slice(0, 5);

  return {
    totalPrints: seen.size,
    totalWeightG,
    totalCost,
    totalFilamentCost,
    totalEnergyCost,
    materials: [...materials].map(([name, grams]) => ({ name, grams })).sort((a, b) => b.grams - a.grams),
    success,
    failure,
    failureTypes: [...failureTypes].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    problemSpools,
  };
}
