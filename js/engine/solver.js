// NexLab — Circuit solver: DC operating point (MNA + Newton for diodes)
// and transient analysis (backward Euler for capacitors).
// All displayed values come from these solves.

import { solveLinearSystem } from './linalg.js';
import {
  stampResistor, stampVoltageSource, stampDiode,
  stampCapacitorTransient, ledModel, diodeCurrent, parseValue,
} from './components.js';

// Index maps: matrix indices 0..N-1 = non-ground node voltages,
// N..N+K-1 = voltage source currents. Ground is not in the matrix.
function buildIndexMaps(netlist) {
  const { nets, groundNet } = netlist;
  const termNet = new Map();
  for (const [netId, terms] of nets) {
    for (const t of terms) termNet.set(`${t.compId}:${t.termIdx}`, netId);
  }
  const getNet = (compId, termIdx) => termNet.get(`${compId}:${termIdx}`) ?? groundNet;

  const netToIdx = new Map();
  let idx = 0;
  for (const netId of nets.keys()) {
    if (netId === groundNet) continue;
    netToIdx.set(netId, idx++);
  }
  // Matrix index for a net: ground → -1 (not in matrix), else 0..N-1
  const getIdx = (netId) => (netId === groundNet ? -1 : netToIdx.get(netId));
  return { nets, groundNet, termNet, getNet, netToIdx, getIdx };
}

// Stamp all components into A/z for the current diode guesses.
function stampCircuit(components, idxMaps, A, z, sourceAuxIdx, diodeState, capPrevV, dt) {
  const { getNet, getIdx, netToIdx } = idxMaps;
  let auxCounter = netToIdx.size; // auxiliary indices start after node voltages
  for (const comp of components) {
    const { type, params } = comp;
    if (type === 'resistor') {
      const R = parseValue(params.resistance ?? '100');
      if (R > 0 && isFinite(R)) {
        stampResistor(A, z, { a: getIdx(getNet(comp.id, 0)), b: getIdx(getNet(comp.id, 1)) }, R);
      }
    } else if (type === 'dc_source') {
      const V = parseValue(params.voltage ?? '12');
      const auxIdx = auxCounter++;
      // termIdx 0 = negative terminal, termIdx 1 = positive terminal
      stampVoltageSource(A, z, { a: getIdx(getNet(comp.id, 1)), b: getIdx(getNet(comp.id, 0)) }, V, auxIdx);
      sourceAuxIdx.set(comp.id, auxIdx);
    } else if (type === 'led') {
      const model = ledModel(parseValue(params.vf ?? '2'));
      const Vd0 = diodeState.get(comp.id) ?? 0.7;
      stampDiode(A, z, { a: getIdx(getNet(comp.id, 0)), b: getIdx(getNet(comp.id, 1)) }, Vd0, model.Is, model.n);
    } else if (type === 'capacitor' && dt != null) {
      const C = parseValue(params.capacitance ?? '100u');
      const prev = capPrevV.get(comp.id) || { Va: 0, Vb: 0 };
      stampCapacitorTransient(A, z, { a: getIdx(getNet(comp.id, 0)), b: getIdx(getNet(comp.id, 1)) }, C, dt, prev.Va, prev.Vb);
    }
  }
}

// Extract per-component results from a solved state vector
function extractResults(components, idxMaps, x, sourceAuxIdx) {
  const { getNet, getIdx } = idxMaps;
  const branchCurrents = new Map();
  const powers = new Map();
  const sourceCurrents = new Map();

  for (const comp of components) {
    const { type, params } = comp;
    const a = getIdx(getNet(comp.id, 0));
    const b = getIdx(getNet(comp.id, 1));
    const Va = a < 0 ? 0 : x[a];
    const Vb = b < 0 ? 0 : x[b];

    if (type === 'resistor') {
      const R = parseValue(params.resistance ?? '100');
      const I = (Va - Vb) / R;
      branchCurrents.set(comp.id, I);
      powers.set(comp.id, (Va - Vb) * I);
    } else if (type === 'dc_source') {
      const k = sourceAuxIdx.get(comp.id);
      const I = k != null ? x[k] : 0;
      // MNA auxiliary current flows from + to - through source;
      // negate to get conventional "current delivered by source" (positive = delivering)
      const Iconv = -I;
      sourceCurrents.set(comp.id, Iconv);
      branchCurrents.set(comp.id, Iconv);
      powers.set(comp.id, (Va - Vb) * Iconv);
    } else if (type === 'led') {
      const model = ledModel(parseValue(params.vf ?? '2'));
      const Vd = Va - Vb;
      const I = diodeCurrent(Vd, model.Is, model.n);
      branchCurrents.set(comp.id, I);
      powers.set(comp.id, Vd * I);
    } else if (type === 'capacitor') {
      branchCurrents.set(comp.id, 0);
      powers.set(comp.id, 0);
    }
  }
  return { branchCurrents, powers, sourceCurrents };
}

// ---------------------------------------------------------------------------
// DC steady-state solve
// ---------------------------------------------------------------------------
export function solveDC(components, wires, netlist) {
  const errors = [];
  const idxMaps = buildIndexMaps(netlist);
  const { nets, groundNet, netToIdx } = idxMaps;

  const sources = components.filter(c => c.type === 'dc_source');
  const N = netToIdx.size;
  const K = sources.length;
  const size = N + K;

  if (size === 0) {
    return { ok: false, errors: ['Nothing to solve — place components and ground.'],
      nodeVoltages: new Map(), branchCurrents: new Map(), powers: new Map(), sourceCurrents: new Map() };
  }

  const diodeState = new Map();
  for (const comp of components) {
    if (comp.type === 'led') diodeState.set(comp.id, 0.7);
  }

  let iter = 0;
  let converged = false;
  let lastX = null;
  let lastSourceAuxIdx = null;

  while (iter < 60 && !converged) {
    iter++;
    const A = Array.from({ length: size }, () => new Array(size).fill(0));
    const z = new Array(size).fill(0);
    const sourceAuxIdx = new Map();

    stampCircuit(components, idxMaps, A, z, sourceAuxIdx, diodeState, null, null);

    const x = solveLinearSystem(A, z);
    if (!x) {
      errors.push('Circuit matrix is singular — check for shorts or floating nodes.');
      break;
    }

    let maxDelta = 0;
    for (const comp of components) {
      if (comp.type !== 'led') continue;
      const a = idxMaps.getIdx(idxMaps.getNet(comp.id, 0));
      const b = idxMaps.getIdx(idxMaps.getNet(comp.id, 1));
      const Vd = (a < 0 ? 0 : x[a]) - (b < 0 ? 0 : x[b]);
      const prev = diodeState.get(comp.id) ?? 0.7;
      maxDelta = Math.max(maxDelta, Math.abs(Vd - prev));
      diodeState.set(comp.id, Vd);
    }

    lastX = x;
    lastSourceAuxIdx = sourceAuxIdx;
    if (maxDelta < 1e-9) converged = true;
  }

  if (!lastX) {
    return { ok: false, errors: errors.length ? errors : ['Solver failed.'],
      nodeVoltages: new Map(), branchCurrents: new Map(), powers: new Map(), sourceCurrents: new Map() };
  }

  const nodeVoltages = new Map();
  nodeVoltages.set(groundNet, 0);
  for (const [netId, i] of netToIdx) nodeVoltages.set(netId, lastX[i]);

  const { branchCurrents, powers, sourceCurrents } = extractResults(components, idxMaps, lastX, lastSourceAuxIdx);

  return { ok: converged, nodeVoltages, branchCurrents, powers, sourceCurrents,
    errors, iterations: iter, converged };
}

// ---------------------------------------------------------------------------
// Transient analysis (backward Euler)
// ---------------------------------------------------------------------------
export function solveTransient(components, wires, netlist, options = {}) {
  const { tMax = 5, dt = 0, speed = 1 } = options;
  const errors = [];
  const idxMaps = buildIndexMaps(netlist);
  const { nets, groundNet, netToIdx } = idxMaps;

  const capacitors = components.filter(c => c.type === 'capacitor');
  const sources = components.filter(c => c.type === 'dc_source');
  const N = netToIdx.size;
  const K = sources.length;
  const size = N + K;

  if (size === 0) {
    return { ok: false, errors: ['Nothing to solve.'],
      timePoints: [], nodeHistory: new Map(), branchCurrents: new Map(), powers: new Map() };
  }

  let dtVal = dt;
  if (!(dtVal > 0)) {
    let tau = 1e-3;
    for (const cap of capacitors) {
      const C = parseValue(cap.params.capacitance ?? '100u');
      tau = Math.max(tau, C * 1000);
    }
    dtVal = Math.max(1e-7, Math.min(tau / 200, 0.01));
  }

  const capPrevV = new Map();
  for (const cap of capacitors) capPrevV.set(cap.id, { Va: 0, Vb: 0 });

  const diodeState = new Map();
  for (const comp of components) {
    if (comp.type === 'led') diodeState.set(comp.id, 0.7);
  }

  const timePoints = [];
  const nodeHistory = new Map();
  for (const netId of nets.keys()) nodeHistory.set(netId, []);

  let t = 0;
  let step = 0;
  const maxSteps = Math.ceil(tMax / dtVal);
  let lastX = null;
  let lastSourceAuxIdx = null;

  while (step < maxSteps && t <= tMax) {
    let iter = 0;
    let converged = false;

    while (iter < 60 && !converged) {
      iter++;
      const A = Array.from({ length: size }, () => new Array(size).fill(0));
      const z = new Array(size).fill(0);
      const sourceAuxIdx = new Map();

      stampCircuit(components, idxMaps, A, z, sourceAuxIdx, diodeState, capPrevV, dtVal);

      const x = solveLinearSystem(A, z);
      if (!x) { errors.push(`Singular matrix at t=${t.toFixed(4)}s`); break; }

      let maxDelta = 0;
      for (const comp of components) {
        if (comp.type !== 'led') continue;
        const a = idxMaps.getIdx(idxMaps.getNet(comp.id, 0));
        const b = idxMaps.getIdx(idxMaps.getNet(comp.id, 1));
        const Vd = (a < 0 ? 0 : x[a]) - (b < 0 ? 0 : x[b]);
        const prev = diodeState.get(comp.id) ?? 0.7;
        maxDelta = Math.max(maxDelta, Math.abs(Vd - prev));
        diodeState.set(comp.id, Vd);
      }

      lastX = x;
      lastSourceAuxIdx = sourceAuxIdx;
      if (maxDelta < 1e-9) converged = true;
    }

    if (!lastX) break;

    timePoints.push(t);
    for (const [netId, hist] of nodeHistory) {
      const i = idxMaps.getIdx(netId);
      hist.push(i < 0 ? 0 : lastX[i]);
    }

    for (const cap of capacitors) {
      const a = idxMaps.getIdx(idxMaps.getNet(cap.id, 0));
      const b = idxMaps.getIdx(idxMaps.getNet(cap.id, 1));
      capPrevV.set(cap.id, { Va: a < 0 ? 0 : lastX[a], Vb: b < 0 ? 0 : lastX[b] });
    }

    t += dtVal;
    step++;

    if (step > 100) {
      let maxChange = 0;
      for (const hist of nodeHistory.values()) {
        if (hist.length < 2) continue;
        maxChange = Math.max(maxChange, Math.abs(hist[hist.length - 1] - hist[hist.length - 2]));
      }
      if (maxChange < 1e-8 && t > 10 * dtVal) break;
    }
  }

  const { branchCurrents, powers } = lastX
    ? extractResults(components, idxMaps, lastX, lastSourceAuxIdx)
    : { branchCurrents: new Map(), powers: new Map() };

  return { ok: errors.length === 0, timePoints, nodeHistory, branchCurrents, powers,
    errors, dt: dtVal, tMax: t };
}

// ---------------------------------------------------------------------------
// Equivalent resistance between two nodes (multimeter R mode)
// ---------------------------------------------------------------------------
export function equivalentResistance(components, wires, netlist, nodeA, nodeB) {
  const idxMaps = buildIndexMaps(netlist);
  const { netToIdx } = idxMaps;
  const sources = components.filter(c => c.type === 'dc_source');
  const N = netToIdx.size;
  const K = sources.length;
  const size = N + K;
  if (size === 0 || nodeA === nodeB) return 0;

  const A = Array.from({ length: size }, () => new Array(size).fill(0));
  const z = new Array(size).fill(0);
  const sourceAuxIdx = new Map();
  const zeroed = components.map(c => c.type === 'dc_source'
    ? { ...c, params: { ...c.params, voltage: '0' } } : c);

  stampCircuit(zeroed, idxMaps, A, z, sourceAuxIdx, new Map(), null, null);

  const idxA = idxMaps.getIdx(nodeA);
  const idxB = idxMaps.getIdx(nodeB);
  if (idxA >= 0) z[idxA] += 1;
  if (idxB >= 0) z[idxB] -= 1;

  const x = solveLinearSystem(A, z);
  if (!x) return Infinity;
  const Va = idxA < 0 ? 0 : x[idxA];
  const Vb = idxB < 0 ? 0 : x[idxB];
  return Math.abs(Va - Vb);
}
