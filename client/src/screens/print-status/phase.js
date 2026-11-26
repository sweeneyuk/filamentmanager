import { printPhase } from '../../lib/printState.js';

const TONES = { preparing: 'info', printing: 'accent', paused: 'warning', finished: 'accent', failed: 'danger', idle: 'neutral', other: 'neutral' };

export function phaseOf(state) {
  const phase = printPhase(state);
  return { ...phase, tone: TONES[phase.id] };
}
