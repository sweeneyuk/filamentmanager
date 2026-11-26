// Temperature and fan decoding, moved unchanged from PrintStatus.jsx.
// The owner has confirmed these readings are correct: do not change the maths.

export function nozzleReadings(state) {
  const extInfo = state?.raw?.device?.extruder?.info;
  if (Array.isArray(extInfo) && extInfo.length > 1) {
    const labels = ['Left nozzle', 'Right nozzle'];
    // Reversed so the left nozzle (originally index 1) comes first.
    return [...extInfo].reverse().map((ext, i) => {
      const isPacked = ext.temp > 1000;
      const temp = isPacked ? (ext.temp & 0xFFFF) : (ext.temp || 0);
      const explicitTarget = isPacked ? (ext.temp >> 16) : ext.htar;
      const target = explicitTarget > 1 ? explicitTarget : (state.raw.nozzle_target_temper || 0);
      return { label: labels[i] || `Nozzle ${i + 1}`, temp, target };
    });
  }
  return [{ label: 'Nozzle', temp: state?.nozzleTemp || 0, target: state?.nozzleTarget || 0 }];
}

export function chamberReading(state) {
  let temp = state?.chamberTemp || 0;
  let target = state?.chamberTarget || 0;
  if (temp > 150) {
    if (temp > 65535) {
      target = target || ((temp >> 16) & 0xFFFF);
      temp = temp & 0xFFFF;
    } else if (temp > 300 && (temp & 0xFF) <= 150) {
      target = target || ((temp >> 8) & 0xFF);
      temp = temp & 0xFF;
    } else if (temp <= 150000) {
      temp = Math.round(temp / 1000);
    }
  }
  return { temp, target };
}

const FANS = [
  ['cooling_fan_speed', 'Part'],
  ['heatbreak_fan_speed', 'Hotend'],
  ['big_fan1_speed', 'Aux'],
  ['big_fan2_speed', 'Chamber'],
];

export function fanReadings(raw) {
  return FANS.map(([key, label]) => {
    if (!raw) return { label, percent: null };
    const speed = parseInt(raw[key] || 0, 10) || 0;
    return { label, percent: Math.round((speed / 15) * 100) };
  });
}
