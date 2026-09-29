// NexLab — Component definitions and MNA stamps.
// Every value the UI displays comes from these models — nothing is fabricated.

export const VT = 0.026; // thermal voltage at room temperature (V)

// ---------------------------------------------------------------------------
// Value parsing: accepts "10k", "4.7K", "1M", "100u", "2.2m", "12", "0.5"
// ---------------------------------------------------------------------------
export function parseValue(text) {
  if (text == null) return NaN;
  const s = String(text).trim().toLowerCase().replace(/\s+/g, '');
  if (s === '') return NaN;
  const m = s.match(/^([0-9]*\.?[0-9]+)([a-z]*)$/);
  if (!m) return NaN;
  const num = parseFloat(m[1]);
  const unit = m[2];
  const mult = { '': 1, 'k': 1e3, 'm': 1e-3, 'u': 1e-6, 'µ': 1e-6, 'n': 1e-9, 'p': 1e-12, 'g': 1e9, 'meg': 1e6 }[unit];
  if (mult === undefined) return NaN;
  return num * mult;
}

export function formatValue(value, unit, digits = 3) {
  if (!isFinite(value)) return '—';
  const abs = Math.abs(value);
  const units = [
    { s: 'G', m: 1e9 }, { s: 'M', m: 1e6 }, { s: 'k', m: 1e3 },
    { s: '', m: 1 }, { s: 'm', m: 1e-3 }, { s: 'µ', m: 1e-6 }, { s: 'n', m: 1e-9 },
  ];
  for (const u of units) {
    if (abs >= u.m || u.m === 1e-9) {
      const v = value / u.m;
      const str = Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(digits).replace(/\.?0+$/, '');
      return `${str} ${u.s}${unit}`;
    }
  }
  return `${value.toExponential(2)} ${unit}`;
}

// ---------------------------------------------------------------------------
// Component catalogue (first-version set per spec section 50)
// ---------------------------------------------------------------------------
export const COMPONENT_DEFS = {
  dc_source: {
    name: 'DC Source', category: 'Sources', unit: 'V', defaultValue: 12,
    params: [{ key: 'voltage', label: 'Voltage', unit: 'V', min: 0, max: 48 }],
    description: 'Ideal DC voltage source. Maintains its terminal voltage regardless of load.',
  },
  resistor: {
    name: 'Resistor', category: 'Passive', unit: 'Ω', defaultValue: 100,
    params: [{ key: 'resistance', label: 'Resistance', unit: 'Ω', min: 0.01, max: 10e6 }],
    description: 'Obey\'s Ohm\'s law: V = IR. Dissipates power as heat.',
  },
  capacitor: {
    name: 'Capacitor', category: 'Passive', unit: 'F', defaultValue: 100e-6,
    params: [{ key: 'capacitance', label: 'Capacitance', unit: 'F', min: 1e-12, max: 1 }],
    description: 'Stores energy in an electric field. Blocks DC, passes changing signals. τ = RC.',
  },
  led: {
    name: 'LED', category: 'Semiconductor', unit: 'V', defaultValue: 2.0,
    params: [{ key: 'vf', label: 'Forward voltage', unit: 'V', min: 1.0, max: 4.0 }],
    description: 'Light-emitting diode. Conducts only when forward biased above its forward voltage.',
  },
  diode: {
    name: 'Diode', category: 'Semiconductor', unit: 'V', defaultValue: 0.7,
    params: [{ key: 'vf', label: 'Forward voltage', unit: 'V', min: 0.2, max: 1.0 }],
    description: 'Standard diode. Conducts only when forward biased above its forward voltage.',
  },
  switch: {
    name: 'Switch', category: 'Control', unit: '', defaultValue: 0,
    params: [],
    description: 'Open or closes a branch. Click the switch body to toggle it.',
  },
  ground: {
    name: 'Ground', category: 'Sources', unit: '', defaultValue: 0,
    params: [],
    description: 'Circuit reference node (0 V). All voltages are measured relative to ground.',
  },
  wire: {
    name: 'Wire', category: 'Connection', unit: '', defaultValue: 0,
    params: [],
    description: 'Ideal connection. Wires join nodes into nets.',
  },
};

// LED diode model parameters (Shockley equation)
export function ledModel(vf) {
  const n = 1.6;
  const Is = 1e-11;
  return { Is, n, Vt: VT };
}

// Diode current: I = Is * (exp(Vd / (n*Vt)) - 1)
export function diodeCurrent(Vd, Is, n) {
  const arg = Math.max(-30, Math.min(30, Vd / (n * VT)));
  return Is * (Math.exp(arg) - 1);
}

// Diode conductance at operating point
export function diodeConductance(Vd, Is, n) {
  const arg = Math.max(-30, Math.min(30, Vd / (n * VT)));
  return (Is / (n * VT)) * Math.exp(arg);
}

// ---------------------------------------------------------------------------
// MNA stamps.
// Convention: matrix index -1 = ground (not in matrix, skipped by stamps).
// Non-ground nets are indexed 0..N-1. Auxiliary source currents are N..N+K-1.
// ---------------------------------------------------------------------------

export function stampResistor(A, z, nodes, resistance) {
  if (!(resistance > 0) || !isFinite(resistance)) return;
  const g = 1 / resistance;
  const { a, b } = nodes;
  if (a >= 0) { A[a][a] += g; if (b >= 0) A[a][b] -= g; }
  if (b >= 0) { A[b][b] += g; if (a >= 0) A[b][a] -= g; }
}

export function stampVoltageSource(A, z, nodes, voltage, auxIdx) {
  const { a, b } = nodes;
  if (a >= 0) { A[a][auxIdx] += 1; A[auxIdx][a] += 1; }
  if (b >= 0) { A[b][auxIdx] -= 1; A[auxIdx][b] -= 1; }
  z[auxIdx] = voltage;
}

export function stampDiode(A, z, nodes, Vd0, Is, n) {
  const I0 = diodeCurrent(Vd0, Is, n);
  const gd = diodeConductance(Vd0, Is, n);
  const { a, b } = nodes;
  if (a >= 0) { A[a][a] += gd; if (b >= 0) A[a][b] -= gd; }
  if (b >= 0) { A[b][b] += gd; if (a >= 0) A[b][a] -= gd; }
  const Ieq = I0 - gd * Vd0;
  if (a >= 0) z[a] -= Ieq;
  if (b >= 0) z[b] += Ieq;
}

export function stampCapacitorTransient(A, z, nodes, capacitance, dt, Va_prev, Vb_prev) {
  const g = capacitance / dt;
  const { a, b } = nodes;
  if (a >= 0) { A[a][a] += g; if (b >= 0) A[a][b] -= g; }
  if (b >= 0) { A[b][b] += g; if (a >= 0) A[b][a] -= g; }
  const Ihist = g * (Va_prev - Vb_prev);
  if (a >= 0) z[a] += Ihist;
  if (b >= 0) z[b] -= Ihist;
}

export function componentPower(Va, Vb, currentAtoB) {
  return (Va - Vb) * currentAtoB;
}
