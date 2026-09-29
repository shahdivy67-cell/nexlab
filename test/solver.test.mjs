// Quick solver verification — run with: node test/solver.test.mjs
import { buildNetlist } from '../js/engine/circuit.js';
import { solveDC, solveTransient, equivalentResistance } from '../js/engine/solver.js';

let pass = 0, fail = 0;
function check(name, actual, expected, tol = 0.01) {
  if (typeof expected === 'boolean') {
    const ok = actual === expected;
    if (ok) { pass++; console.log(`  PASS ${name}: ${actual} (expected ${expected})`); }
    else { fail++; console.log(`  FAIL ${name}: ${actual} (expected ${expected})`); }
    return;
  }
  const err = Math.abs(actual - expected);
  const ok = err <= tol * Math.max(1, Math.abs(expected));
  if (ok) { pass++; console.log(`  PASS ${name}: ${actual.toFixed(6)} (expected ${expected})`); }
  else { fail++; console.log(`  FAIL ${name}: ${actual} (expected ${expected}, err ${err})`); }
}

console.log('--- Test 1: Ohm\'s law (12V, 6Ω → 2A) ---');
{
  const comps = [
    { id: 's1', type: 'dc_source', x: 100, y: 100, rotation: 0, params: { voltage: '12' } },
    { id: 'r1', type: 'resistor', x: 200, y: 100, rotation: 0, params: { resistance: '6' } },
    { id: 'g1', type: 'ground', x: 300, y: 100, rotation: 0, params: {} },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 140, y: 100 }, { x: 160, y: 100 }] },
    { id: 'w2', points: [{ x: 240, y: 100 }, { x: 300, y: 100 }] },
    { id: 'w3', points: [{ x: 60, y: 100 }, { x: 60, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 100 }] },
  ];
  const nl = buildNetlist(comps, wires);
  const sol = solveDC(comps, wires, nl);
  check('current through resistor', sol.branchCurrents.get('r1'), 2.0);
  check('power dissipated', sol.powers.get('r1'), 24.0);
  check('source current', sol.sourceCurrents.get('s1'), 2.0);
}

console.log('--- Test 2: Series resistors (12V, 4Ω+8Ω → 1A) ---');
{
  const comps = [
    { id: 's1', type: 'dc_source', x: 100, y: 100, rotation: 0, params: { voltage: '12' } },
    { id: 'r1', type: 'resistor', x: 200, y: 100, rotation: 0, params: { resistance: '4' } },
    { id: 'r2', type: 'resistor', x: 300, y: 100, rotation: 0, params: { resistance: '8' } },
    { id: 'g1', type: 'ground', x: 400, y: 100, rotation: 0, params: {} },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 140, y: 100 }, { x: 160, y: 100 }] },
    { id: 'w2', points: [{ x: 240, y: 100 }, { x: 260, y: 100 }] },
    { id: 'w3', points: [{ x: 340, y: 100 }, { x: 400, y: 100 }] },
    { id: 'w4', points: [{ x: 60, y: 100 }, { x: 60, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 100 }] },
  ];
  const nl = buildNetlist(comps, wires);
  const sol = solveDC(comps, wires, nl);
  check('series current', sol.branchCurrents.get('r1'), 1.0);
  check('series current r2', sol.branchCurrents.get('r2'), 1.0);
}

console.log('--- Test 3: Parallel resistors (12V, 6Ω||3Ω → 6A total) ---');
{
  const comps = [
    { id: 's1', type: 'dc_source', x: 100, y: 100, rotation: 0, params: { voltage: '12' } },
    { id: 'r1', type: 'resistor', x: 200, y: 60, rotation: 0, params: { resistance: '6' } },
    { id: 'r2', type: 'resistor', x: 200, y: 140, rotation: 0, params: { resistance: '3' } },
    { id: 'g1', type: 'ground', x: 300, y: 100, rotation: 0, params: {} },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 140, y: 100 }, { x: 160, y: 60 }, { x: 160, y: 140 }] },
    { id: 'w2', points: [{ x: 240, y: 60 }, { x: 300, y: 60 }, { x: 300, y: 140 }, { x: 240, y: 140 }] },
    { id: 'w3', points: [{ x: 60, y: 100 }, { x: 60, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 100 }] },
  ];
  const nl = buildNetlist(comps, wires);
  const sol = solveDC(comps, wires, nl);
  check('parallel branch 1', sol.branchCurrents.get('r1'), 2.0);
  check('parallel branch 2', sol.branchCurrents.get('r2'), 4.0);
  check('total current', sol.sourceCurrents.get('s1'), 6.0);
}

console.log('--- Test 4: LED + resistor (12V, 1kΩ, LED Vf≈2V → ~10mA) ---');
{
  const comps = [
    { id: 's1', type: 'dc_source', x: 100, y: 100, rotation: 0, params: { voltage: '12' } },
    { id: 'r1', type: 'resistor', x: 200, y: 100, rotation: 0, params: { resistance: '1000' } },
    { id: 'led1', type: 'led', x: 300, y: 100, rotation: 0, params: { vf: '2' } },
    { id: 'g1', type: 'ground', x: 400, y: 100, rotation: 0, params: {} },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 140, y: 100 }, { x: 160, y: 100 }] },
    { id: 'w2', points: [{ x: 240, y: 100 }, { x: 260, y: 100 }] },
    { id: 'w3', points: [{ x: 340, y: 100 }, { x: 400, y: 100 }] },
    { id: 'w4', points: [{ x: 60, y: 100 }, { x: 60, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 100 }] },
  ];
  const nl = buildNetlist(comps, wires);
  const sol = solveDC(comps, wires, nl);
  const I = sol.branchCurrents.get('led1');
  check('LED current ~10mA', I, 0.010, 0.05);
  check('LED conducts', I > 0.005, true);
}

console.log('--- Test 5: RC transient (12V, 1kΩ, 100µF → τ=0.1s) ---');
{
  const comps = [
    { id: 's1', type: 'dc_source', x: 100, y: 100, rotation: 0, params: { voltage: '12' } },
    { id: 'r1', type: 'resistor', x: 200, y: 100, rotation: 0, params: { resistance: '1000' } },
    { id: 'c1', type: 'capacitor', x: 300, y: 100, rotation: 0, params: { capacitance: '100u' } },
    { id: 'g1', type: 'ground', x: 400, y: 100, rotation: 0, params: {} },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 140, y: 100 }, { x: 160, y: 100 }] },
    { id: 'w2', points: [{ x: 240, y: 100 }, { x: 260, y: 100 }] },
    { id: 'w3', points: [{ x: 340, y: 100 }, { x: 400, y: 100 }] },
    { id: 'w4', points: [{ x: 60, y: 100 }, { x: 60, y: 200 }, { x: 400, y: 200 }, { x: 400, y: 100 }] },
  ];
  const nl = buildNetlist(comps, wires);
  const sol = solveTransient(comps, wires, nl, { tMax: 1, dt: 1e-4 });
  const capNet = [...nl.nets.entries()].find(([_, terms]) => terms.some(t => t.compId === 'c1' && t.termIdx === 0))?.[0];
  const hist = sol.nodeHistory.get(capNet);
  const tArr = sol.timePoints;
  let vAtTau = 0;
  for (let i = 0; i < tArr.length; i++) {
    if (tArr[i] >= 0.1) { vAtTau = hist[i]; break; }
  }
  check('Vcap at t=τ ≈ 63%', vAtTau, 12 * 0.632, 0.03);
  check('Vcap final ≈ 12V', hist[hist.length - 1], 12, 0.02);
}

console.log('--- Test 6: Equivalent resistance (6Ω || 3Ω = 2Ω) ---');
{
  const comps = [
    { id: 'r1', type: 'resistor', x: 100, y: 60, rotation: 0, params: { resistance: '6' } },
    { id: 'r2', type: 'resistor', x: 100, y: 140, rotation: 0, params: { resistance: '3' } },
    { id: 'g1', type: 'ground', x: 200, y: 100, rotation: 0, params: {} },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 60, y: 60 }, { x: 60, y: 140 }] },
    { id: 'w2', points: [{ x: 140, y: 60 }, { x: 200, y: 60 }, { x: 200, y: 140 }, { x: 140, y: 140 }] },
  ];
  const nl = buildNetlist(comps, wires);
  const nets = [...nl.nets.keys()];
  const req = equivalentResistance(comps, wires, nl, nets[0], nets[1] ?? nets[0]);
  check('6||3 = 2Ω', req, 2.0, 0.02);
}

console.log('--- Test 7: Open circuit (no ground → error) ---');
{
  const comps = [
    { id: 's1', type: 'dc_source', x: 100, y: 100, rotation: 0, params: { voltage: '12' } },
    { id: 'r1', type: 'resistor', x: 200, y: 100, rotation: 0, params: { resistance: '100' } },
  ];
  const wires = [
    { id: 'w1', points: [{ x: 140, y: 100 }, { x: 160, y: 100 }] },
  ];
  const nl = buildNetlist(comps, wires);
  check('no ground error', nl.errors.length > 0, true);
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
