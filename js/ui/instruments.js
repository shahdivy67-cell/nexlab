// NexLab — Virtual instruments: multimeter and oscilloscope

import { getDCSolution, getScopeData, getScopeChannels, getScopeEnabled, getScopeColors, getScopeVdiv, getScopeTdiv, getScopeTimePoints, getScopeNodeHistory, getProbes, getComponents, getWires } from './simulator.js?v=10';
import { buildNetlist, getLeads } from '../engine/circuit.js?v=5';
import { equivalentResistance } from '../engine/solver.js?v=2';
import { formatValue, parseValue } from '../engine/components.js';

let multimeterMode = 'voltage';
let scopeCanvas, scopeCtx;
let scopeRunning = false;
let scopeAnimFrame = null;

export function initInstruments() {
  scopeCanvas = document.getElementById('scope-canvas');
  if (scopeCanvas) {
    scopeCtx = scopeCanvas.getContext('2d');
    resizeScope();
    window.addEventListener('resize', resizeScope);
  }
  updateMultimeter();
  drawScope();
}

function resizeScope() {
  if (!scopeCanvas) return;
  const wrap = scopeCanvas.parentElement;
  scopeCanvas.width = wrap.clientWidth;
  scopeCanvas.height = 200;
  drawScope();
}

export function setMultimeterMode(mode) {
  multimeterMode = mode;
  updateMultimeter();
}

export function updateMultimeter() {
  const display = document.getElementById('multimeter-display');
  if (!display) return;

  const probes = getProbes();
  const solution = getDCSolution();

  if (probes.red === null || probes.black === null) {
    display.textContent = '— — —';
    return;
  }

  if (!solution || !solution.ok) {
    display.textContent = 'ERR';
    return;
  }

  const netlist = buildNetlist(getComponents(), getWires());

  switch (multimeterMode) {
    case 'voltage': {
      const V = (solution.nodeVoltages.get(probes.red) ?? 0) - (solution.nodeVoltages.get(probes.black) ?? 0);
      display.textContent = formatValue(V, 'V');
      break;
    }
    case 'current': {
      // Find component between the two probe nets
      let I = 0;
      for (const [compId, current] of solution.branchCurrents) {
        const comp = getComponents().find(c => c.id === compId);
        if (!comp) continue;
        const leads = comp.type === 'ground' ? [{ x: comp.x, y: comp.y }] : getLeadsForComp(comp);
        // Simplified: show total current through the red probe net
        I = current;
        break;
      }
      display.textContent = formatValue(I, 'A');
      break;
    }
    case 'resistance': {
      const R = equivalentResistance(getComponents(), getWires(), netlist, probes.red, probes.black);
      display.textContent = formatValue(R, 'Ω');
      break;
    }
    case 'continuity': {
      const R = equivalentResistance(getComponents(), getWires(), netlist, probes.red, probes.black);
      display.textContent = R < 10 ? 'BEEP' : 'OPEN';
      break;
    }
    case 'diode': {
      // Find LED between probes
      const led = getComponents().find(c => c.type === 'led');
      if (led) {
        const I = solution.branchCurrents.get(led.id) ?? 0;
        const V = (solution.nodeVoltages.get(probes.red) ?? 0) - (solution.nodeVoltages.get(probes.black) ?? 0);
        display.textContent = I > 0.001 ? formatValue(V, 'V') : 'OL';
      } else {
        display.textContent = 'OL';
      }
      break;
    }
  }
}

function getLeadsForComp(comp) {
  return getLeads(comp);
}

export function drawScope() {
  if (!scopeCtx) return;
  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  scopeCtx.clearRect(0, 0, w, h);

  // Background
  scopeCtx.fillStyle = '#000';
  scopeCtx.fillRect(0, 0, w, h);

  // Grid
  scopeCtx.strokeStyle = '#1a1a2e';
  scopeCtx.lineWidth = 1;
  const vDivs = 8, hDivs = 10;
  for (let i = 0; i <= vDivs; i++) {
    const y = (i / vDivs) * h;
    scopeCtx.beginPath(); scopeCtx.moveTo(0, y); scopeCtx.lineTo(w, y); scopeCtx.stroke();
  }
  for (let i = 0; i <= hDivs; i++) {
    const x = (i / hDivs) * w;
    scopeCtx.beginPath(); scopeCtx.moveTo(x, 0); scopeCtx.lineTo(x, h); scopeCtx.stroke();
  }

  // Center line
  scopeCtx.strokeStyle = '#333';
  scopeCtx.beginPath(); scopeCtx.moveTo(0, h / 2); scopeCtx.lineTo(w, h / 2); scopeCtx.stroke();

  // Waveforms
  const scopeData = getScopeData();
  const channels = getScopeChannels();
  const enabled = getScopeEnabled();
  const colors = getScopeColors();
  const timePoints = getScopeTimePoints();
  const nodeHistory = getScopeNodeHistory();

  if (timePoints.length < 2) {
    scopeCtx.fillStyle = '#4a5568';
    scopeCtx.font = '12px Inter, sans-serif';
    scopeCtx.textAlign = 'center';
    scopeCtx.fillText('No data — run simulation and record', w / 2, h / 2);
    return;
  }

  const vdiv = getScopeVdiv();
  const tdiv = getScopeTdiv();
  const tMax = timePoints[timePoints.length - 1] || 1;

  for (let ch = 0; ch < 4; ch++) {
    if (!enabled[ch] || channels[ch] === null) continue;
    const data = nodeHistory.get(ch);
    if (!data || data.length < 2) continue;

    scopeCtx.strokeStyle = colors[ch];
    scopeCtx.lineWidth = 2;
    scopeCtx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = (timePoints[i] / tMax) * w;
      const y = h / 2 - (data[i] / vdiv) * (h / 2) * 0.8;
      if (i === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();

    // Label
    scopeCtx.fillStyle = colors[ch];
    scopeCtx.font = '10px Inter, sans-serif';
    scopeCtx.textAlign = 'left';
    scopeCtx.fillText(`CH${ch + 1}`, 4, 12 + ch * 14);
  }
}

export function toggleScope() {
  scopeRunning = !scopeRunning;
  if (scopeRunning) scopeLoop();
  else cancelAnimationFrame(scopeAnimFrame);
}

function scopeLoop() {
  if (!scopeRunning) return;
  drawScope();
  scopeAnimFrame = requestAnimationFrame(scopeLoop);
}

export function resetScope() {
  drawScope();
}

export function getScopeStats() {
  const scopeData = getScopeData();
  const channels = getScopeChannels();
  const enabled = getScopeEnabled();
  const nodeHistory = getScopeNodeHistory();
  const stats = [];

  for (let ch = 0; ch < 4; ch++) {
    if (!enabled[ch] || channels[ch] === null) continue;
    const data = nodeHistory.get(ch);
    if (!data || data.length === 0) continue;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const mean = data.reduce((s, v) => s + v, 0) / data.length;
    const vpp = max - min;
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
    stats.push({ ch, min, max, mean, vpp, rms });
  }
  return stats;
}
