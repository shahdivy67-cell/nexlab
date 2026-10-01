// NexLab — Text-to-circuit builder: turns plain-English requests
// ("LED glow with 9V and 15mA") into placed, wired, solvable circuits.
// Pure logic, zero imports — unit-testable in Node.

const VF_LED = 0.9; // modeled silicon-ish knee of the built-in LED Shockley model
const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];

export function snapE12(r) {
  if (!(r > 0) || !isFinite(r)) return r;
  const exp = Math.floor(Math.log10(r));
  const mant = r / Math.pow(10, exp);
  let best = E12[0], bestD = Infinity;
  for (const v of [...E12, 10]) {
    const d = Math.abs(v - mant);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best * Math.pow(10, exp);
}

export function fmtR(r) {
  return fmtExact(snapE12(r));
}

export function fmtExact(r) {
  if (!(r > 0) || !isFinite(r)) return String(r);
  if (r >= 1000) return trimNum(r / 1000) + 'k';
  return String(Math.round(r * 100) / 100);
}

function trimNum(n) {
  return String(Math.round(n * 100) / 100);
}

// ---- number extraction (first match wins unless noted) ----
function allMatches(re, text) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) out.push(parseFloat(m[1]));
  return out;
}

export function parseSpecs(text) {
  const t = ' ' + text.toLowerCase() + ' ';
  const specs = { volts: null, amps: null, resistances: [], capacitances: [] };
  const mv = allMatches(/(\d+(?:\.\d+)?)\s*mv\b/g, t);
  const v = allMatches(/(\d+(?:\.\d+)?)\s*v(olts?)?\b/g, t).filter(x => !mv.includes(x));
  if (v.length > 0) specs.volts = v[0];
  else if (mv.length > 0) specs.volts = mv[0] / 1000;
  const cur = allMatches(/(\d+(?:\.\d+)?)\s*(ma|milliamps?|milliamperes?|amps?|amperes?|a)\b/g, t);
  // re-scan with units to scale mA correctly
  const curRe = /(\d+(?:\.\d+)?)\s*(ma|milliamps?|milliamperes?|amps?|amperes?|a)\b/g;
  let m;
  while ((m = curRe.exec(t)) !== null) {
    const val = parseFloat(m[1]);
    specs.amps = m[2].startsWith('m') ? val / 1000 : val;
    break;
  }
  void cur;
  const resRe = /(\d+(?:\.\d+)?)\s*(k|kilohms?|kilohm|ohms?|ω|Ω)\b/g;
  while ((m = resRe.exec(t)) !== null) {
    const val = parseFloat(m[1]);
    specs.resistances.push(/k/i.test(m[2]) ? val * 1000 : val);
  }
  const capRe = /(\d+(?:\.\d+)?)\s*(uf|µf|nf|pf|farads?|f)\b/g;
  while ((m = capRe.exec(t)) !== null) {
    const val = parseFloat(m[1]);
    const u = m[2].toLowerCase();
    const mult = u.startsWith('u') || u.startsWith('µ') ? 1e-6 : u.startsWith('n') ? 1e-9 : u.startsWith('p') ? 1e-12 : 1;
    specs.capacitances.push(val * mult);
  }
  const cnt = t.match(/(\d+)\s*(?:x\s*)?resistors?\b/);
  specs.count = cnt ? parseInt(cnt[1], 10) : null;
  return specs;
}

// ---- layout: horizontal series loop with bottom return rail + ground ----
let uidCounter = 0;
function nid(prefix) {
  uidCounter += 1;
  return `${prefix}_b${Date.now().toString(36)}${uidCounter}`;
}

export function seriesLoop(items, opts = {}) {
  const y = opts.y ?? 220;
  const x0 = opts.x0 ?? 170;
  const dx = opts.dx ?? 170;
  const railY = y + 150;
  const components = items.map((it, i) => ({
    id: nid(it.type[0]),
    type: it.type,
    x: x0 + i * dx,
    y,
    rotation: 0,
    params: it.params || {},
    ...(it.state ? { state: it.state } : {}),
  }));
  const wires = [];
  const L = i => ({ x: components[i].x - 40, y });
  const R = i => ({ x: components[i].x + 40, y });
  for (let i = 0; i < components.length - 1; i++) {
    wires.push({ id: nid('w'), points: [R(i), L(i + 1)] });
  }
  const firstX = L(0).x, lastX = R(components.length - 1).x;
  wires.push({
    id: nid('w'),
    points: [{ x: lastX, y }, { x: lastX, y: railY }, { x: firstX, y: railY }, { x: firstX, y }],
  });
  const gx = Math.round((firstX + lastX) / 2);
  components.push({ id: nid('g'), type: 'ground', x: gx, y: railY, rotation: 0, params: {} });
  return { components, wires };
}

export function parallelPair(rA, rB, vs) {
  const topY = 140, botY = 340;
  const components = [
    { id: nid('s'), type: 'dc_source', x: 140, y: 240, rotation: 1, params: { voltage: String(vs) } },
    { id: nid('r'), type: 'resistor', x: 320, y: 240, rotation: 1, params: { resistance: fmtExact(rA) } },
    { id: nid('r'), type: 'resistor', x: 490, y: 240, rotation: 1, params: { resistance: fmtExact(rB) } },
    { id: nid('g'), type: 'ground', x: 405, y: botY, rotation: 0, params: {} },
  ];
  const wires = [
    { id: nid('w'), points: [{ x: 140, y: 200 }, { x: 140, y: topY }] },
    { id: nid('w'), points: [{ x: 140, y: topY }, { x: 490, y: topY }] },
    { id: nid('w'), points: [{ x: 140, y: 280 }, { x: 140, y: botY }, { x: 490, y: botY }] },
    // vertical stubs: branch leads down/up to the rails
    { id: nid('w'), points: [{ x: 320, y: 200 }, { x: 320, y: topY }] },
    { id: nid('w'), points: [{ x: 320, y: 280 }, { x: 320, y: botY }] },
    { id: nid('w'), points: [{ x: 490, y: 200 }, { x: 490, y: topY }] },
    { id: nid('w'), points: [{ x: 490, y: 280 }, { x: 490, y: botY }] },
  ];
  return { components, wires };
}

// ---- main entry ----
const EXAMPLES = [
  '"LED glow with 9V and 15mA"',
  '"voltage divider 12V, 4k and 2k"',
  '"series circuit with 3 resistors"',
  '"parallel two 100 ohm resistors on 9V"',
  '"RC charging circuit, 10k and 100uF"',
  '"current limiter for 20mA from 12V"',
];

export function buildCircuitFromText(rawText) {
  const text = (rawText || '').trim();
  const t = text.toLowerCase();
  if (!text) {
    return { ok: false, error: 'Describe a circuit first.', suggestions: 'Try: ' + EXAMPLES[0] };
  }
  const specs = parseSpecs(t);
  const Vs = specs.volts ?? 9;

  // 1. LED glow (also covers "diode", "blink", "light up", "switch")
  if (/l[eë]d|diode|glow|light\s*(it|up|the)|blink|flash|bright|switch|on\/off|toggle/.test(t)) {
    const isDiodeWord = /diode/.test(t) && !/l[eë]d/.test(t);
    const wantSwitch = /switch|on\/off|toggle/.test(t);
    let R, note;
    if (specs.resistances.length > 0) {
      R = specs.resistances[0];
      const I = (Vs - VF_LED) / R;
      note = `With your ${fmtExact(R)} resistor the LED gets about ${trimNum(I * 1000)} mA.`;
    } else {
      const Itarget = specs.amps ?? 0.015;
      R = (Vs - VF_LED) / Itarget;
      note = `For ~${trimNum(Itarget * 1000)} mA from ${Vs} V (LED drops ~${VF_LED} V), R = (${Vs} − ${VF_LED}) / ${trimNum(Itarget * 1000)} mA ≈ ${fmtR(R)} (nearest standard value).`;
    }
    const userR = specs.resistances.length > 0;
    const items = [
      { type: 'dc_source', params: { voltage: String(Vs) } },
      { type: 'resistor', params: { resistance: userR ? fmtExact(R) : fmtR(R) } },
    ];
    if (wantSwitch) items.push({ type: 'switch', params: {}, state: { closed: true } });
    items.push({ type: 'led', params: isDiodeWord ? { vf: '0.7' } : { vf: '2' } });
    const setup = seriesLoop(items);
    const switchNote = wantSwitch ? ' It starts ON — click the switch body to turn it OFF and watch the current die.' : '';
    return {
      ok: true,
      kind: 'led',
      title: (isDiodeWord ? 'Diode circuit' : 'Glowing LED circuit') + (wantSwitch ? ' with switch' : ''),
      setup,
      explanation: `${note}${switchNote} Press Run — the LED lens pulses red and the inspector shows live current. Double-click the resistor to try other values and watch the brightness follow.`,
    };
  }

  // 2. Voltage divider
  if (/divid|vout|tap\s*off/.test(t)) {
    const r1 = specs.resistances[0] ?? 4000;
    const r2 = specs.resistances[1] ?? 2000;
    const vout = Vs * r2 / (r1 + r2);
    const setup = seriesLoop([
      { type: 'dc_source', params: { voltage: String(Vs) } },
      { type: 'resistor', params: { resistance: fmtExact(r1) } },
      { type: 'resistor', params: { resistance: fmtExact(r2) } },
    ]);
    return {
      ok: true,
      kind: 'divider',
      title: 'Voltage divider',
      setup,
      explanation: `Output across the second resistor: ${Vs} V × ${fmtExact(r2)} / (${fmtExact(r1)} + ${fmtExact(r2)}) ≈ ${trimNum(vout)} V. Place the red probe between the resistors to measure it.`,
    };
  }

  // 3. RC charging / timer
  if (/\brc\b|capacitor|timer|charg|delay/.test(t)) {
    const R = specs.resistances[0] ?? 10000;
    const C = specs.capacitances[0] ?? 100e-6;
    const tau = R * C;
    const setup = seriesLoop([
      { type: 'dc_source', params: { voltage: String(Vs) } },
      { type: 'resistor', params: { resistance: fmtExact(R) } },
      { type: 'capacitor', params: { capacitance: fmtC(C) } },
    ]);
    return {
      ok: true,
      kind: 'rc',
      title: 'RC charging circuit',
      setup,
      explanation: `Time constant τ = R × C ≈ ${trimNum(tau)} s. Switch the sim to Transient mode and press Run to watch the capacitor charge — it reaches ~63% of ${Vs} V after one τ.`,
    };
  }

  // 4. Parallel
  if (/parallel/.test(t)) {
    const rA = specs.resistances[0] ?? 100;
    const rB = specs.resistances[1] ?? specs.resistances[0] ?? 100;
    const req = 1 / (1 / rA + 1 / rB);
    return {
      ok: true,
      kind: 'parallel',
      title: 'Parallel resistors',
      setup: parallelPair(rA, rB, Vs),
      explanation: `Both branches see the full ${Vs} V. Equivalent resistance: ${fmtExact(rA)} ∥ ${fmtExact(rB)} ≈ ${fmtExact(req)} — total current ≈ ${trimNum(Vs / req * 1000)} mA.`,
    };
  }

  // 5. Series (explicit or "N resistors")
  if (/series|\bresistors?\b/.test(t) && (specs.count || /series/.test(t) || (specs.resistances.length > 1 && !/divid/.test(t)))) {
    let vals = specs.resistances.slice();
    const n = specs.count ?? (vals.length > 0 ? vals.length : 3);
    while (vals.length < n) vals.push(100);
    vals = vals.slice(0, Math.min(n, 5));
    const total = vals.reduce((s, v) => s + v, 0);
    const setup = seriesLoop([
      { type: 'dc_source', params: { voltage: String(Vs) } },
      ...vals.map(r => ({ type: 'resistor', params: { resistance: fmtExact(r) } })),
    ]);
    return {
      ok: true,
      kind: 'series',
      title: `Series resistors (${vals.length})`,
      setup,
      explanation: `Same current everywhere: ${Vs} V / ${fmtExact(total)} total ≈ ${trimNum(Vs / total * 1000)} mA. Each resistor drops a share of the ${Vs} V.`,
    };
  }

  // 6. Current limiter
  if (/limit|20\s*ma|safe current/.test(t) || (specs.amps && !/led|divid|rc|parallel|series/.test(t))) {
    const Itarget = specs.amps ?? 0.02;
    const R = Vs / Itarget;
    const setup = seriesLoop([
      { type: 'dc_source', params: { voltage: String(Vs) } },
      { type: 'resistor', params: { resistance: fmtR(R) } },
    ]);
    return {
      ok: true,
      kind: 'limiter',
      title: 'Current limiter',
      setup,
      explanation: `R = ${Vs} V / ${trimNum(Itarget * 1000)} mA ≈ ${fmtR(R)}. It burns ${(Vs * Itarget).toFixed(2)} W — check the power readout stays within a real resistor's rating.`,
    };
  }

  // 7. Ohm's law demo
  if (/ohm/.test(t)) {
    const R = specs.resistances[0] ?? 100;
    const setup = seriesLoop([
      { type: 'dc_source', params: { voltage: String(Vs) } },
      { type: 'resistor', params: { resistance: fmtExact(R) } },
    ]);
    return {
      ok: true,
      kind: 'ohms-law',
      title: "Ohm's law demo",
      setup,
      explanation: `I = V / R = ${Vs} / ${fmtExact(R)} ≈ ${trimNum(Vs / R * 1000)} mA. Predict it, run it, then double-click the resistor and halve it.`,
    };
  }

  return {
    ok: false,
    error: `I couldn't turn "${text}" into a circuit.`,
    suggestions: 'Try one of these: ' + EXAMPLES.slice(0, 3).join(', ') + '.',
  };
}

function fmtC(c) {
  if (c >= 1e-3) return trimNum(c) ;
  if (c >= 1e-6) return trimNum(c * 1e6) + 'u';
  if (c >= 1e-9) return trimNum(c * 1e9) + 'n';
  return trimNum(c * 1e12) + 'p';
}
