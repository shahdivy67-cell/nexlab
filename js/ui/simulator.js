// NexLab — Circuit simulator: canvas editor, simulation controls, instruments

import { buildNetlist, getLeads, serializeCircuit, deserializeCircuit } from '../engine/circuit.js?v=5';
import { solveDC, solveTransient, equivalentResistance } from '../engine/solver.js';
import { COMPONENT_DEFS, parseValue, formatValue } from '../engine/components.js';
import { buildCircuitFromText } from './circuitBuilder.js';
import { getState, saveState, updateState, addDiscovery } from '../state.js';

let canvas, ctx;
let components = [];
let wires = [];
let selectedComp = null;
let selectedTool = 'select';
let placingType = null;
let simRunning = false;
let simTime = 0;
let simSpeed = 1;
let simMode = 'dc';
let dcSolution = null;
let transientData = null;
let animFrame = null;
let panOffset = { x: 0, y: 0 };
let zoom = 1;
let wireStart = null;
let mousePos = { x: 0, y: 0 };
let probes = { red: null, black: null };
let scopeChannels = [null, null, null, null];
let scopeEnabled = [true, false, false, false];
let scopeTime = 0;
let scopeMaxTime = 1.0;
let scopeDt = 1e-4;
let scopeNodeHistory = new Map();
let scopeTimePoints = [];
let scopeRecording = false;
let scopeVdiv = 2;
let scopeTdiv = 0.1;
let scopeColors = ['#00d4ff', '#ff6b6b', '#22c55e', '#f59e0b'];
let simErrors = [];
let simWarnings = [];
let lastSimTime = 0;
let simDt = 1e-4;
let simTmax = 5;
let simSpeedOptions = [0.1, 1, 10, 100];
let simSpeedIndex = 1;
let hintLevel = 0;
let currentExperiment = null;
let experimentStep = 0;
let predictionValue = null;
let predictionResult = null;
let faultActive = null;
let faultComponent = null;
let branchHistory = [];
let mentorMessages = [];
let notebookEntry = null;
let viewMode = '2d';
let sim3dMod = null;

export function initSimulator() {
  const container = document.getElementById('view-container');
  if (!container) return;

  // Render simulator layout
  const categories = {};
  for (const [type, def] of Object.entries(COMPONENT_DEFS)) {
    if (!categories[def.category]) categories[def.category] = [];
    categories[def.category].push({ type, name: def.name });
  }

  const svgOpen = '<svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">';
  const ICONS = {
    select: `${svgOpen}<path d="M6 1 L15 8 L10.5 8.6 L12.5 14 L10.5 14.6 L8.5 9.2 L5.5 11 Z" fill="currentColor" stroke="none"/></svg>`,
    wire: `${svgOpen}<path d="M4 13 L12 3"/><circle cx="4" cy="13" r="2.2" fill="currentColor" stroke="none"/><circle cx="12" cy="3" r="2.2" fill="currentColor" stroke="none"/></svg>`,
    delete: `${svgOpen}<path d="M5 3 L17 13 M17 3 L5 13"/></svg>`,
    probe: `${svgOpen}<circle cx="11" cy="5.5" r="3" fill="currentColor" stroke="none"/><path d="M11 8.5 V15 M7 15 H15"/></svg>`,
    destroy: `${svgOpen}<path d="M4 4.5 H18 M8.5 4.5 V2.5 H13.5 V4.5 M6.5 4.5 L7.5 14 H14.5 L15.5 4.5 M10 7 V11.5 M12.5 7 V11.5"/></svg>`,
    dc_source: `${svgOpen}<rect x="3" y="4" width="12" height="8" rx="1.5"/><path d="M15 6.5 H18.5 V9.5 H15 M5.5 6.3 V9.7 M4 8 H7"/></svg>`,
    resistor: `${svgOpen}<path d="M1.5 8 H4.5 L6.5 3.5 L9.5 12.5 L12 3.5 L14.5 12.5 L16.5 8 H20.5"/></svg>`,
    capacitor: `${svgOpen}<path d="M8.5 2.5 V13.5 M13.5 2.5 V13.5 M2 8 H8.5 M13.5 8 H20"/></svg>`,
    led: `${svgOpen}<path d="M2.5 11.5 L9.5 5 L9.5 12.5 L2.5 11.5 Z"/><path d="M9.5 5 V12.5 M12.5 3.5 L16 1.5 M14.5 6.5 L18 4.5"/></svg>`,
    diode: `${svgOpen}<path d="M2.5 11.5 L10.5 4 L10.5 13 L2.5 11.5 Z" fill="currentColor" stroke="none"/><path d="M10.5 4 V13 M12.5 8 H19.5"/></svg>`,
    switch: `${svgOpen}<path d="M1.5 11.5 H7 M15 11.5 H20.5"/><circle cx="7" cy="11.5" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="11.5" r="1.6" fill="currentColor" stroke="none"/><path d="M7 11.5 L13 5.5"/></svg>`,
    ground: `${svgOpen}<path d="M11 1 V5.5 M5 5.5 H17 M7.5 8.5 H14.5 M9.5 11.5 H12.5 M10.8 14 H11.2"/></svg>`,
    wirecomp: `${svgOpen}<path d="M1.5 8 H20.5"/><circle cx="11" cy="8" r="2.4"/></svg>`,
  };
  const pic = key => `<span class="palette-icon">${ICONS[key] || ICONS.wirecomp}</span>`;

  container.innerHTML = `
    <div class="sim-layout">
      <div class="sim-palette">
        <div class="palette-category">Tools</div>
        <div class="palette-item" onclick="window.nexlabSetTool('select')">${ICONS.select}Select</div>
        <div class="palette-item" onclick="window.nexlabSetTool('wire')">${ICONS.wire}Wire</div>
        <div class="palette-item" onclick="window.nexlabSetTool('delete')">${ICONS.delete}Delete</div>
        <div class="palette-item" onclick="window.nexlabSetTool('probe')">${ICONS.probe}Probe</div>
        <div class="palette-item" onclick="window.nexlabDestroy()">${ICONS.destroy}Destroy</div>
        ${Object.entries(categories).map(([cat, items]) => `
          <div class="palette-category">${cat}</div>
          ${items.map(i => `<div class="palette-item" onclick="window.nexlabAddComponent('${i.type}')">${pic(i.type === 'wire' ? 'wirecomp' : i.type)}${i.name}</div>`).join('')}
        `).join('')}
      </div>
      <div class="sim-canvas-wrap">
        <canvas id="sim-canvas" class="sim-canvas"></canvas>
        <div id="sim-3d" class="sim-3d" style="display:none"></div>
        <div class="sim-buildbar">
          <span class="build-spark">✦</span>
          <input id="sim-build-input" placeholder='Describe a circuit — e.g. "LED glow with 9V and 15mA"' onkeydown="if(event.key==='Enter')window.nexlabBuildCircuit()">
          <button class="btn btn-primary btn-sm" onclick="window.nexlabBuildCircuit()">Build</button>
        </div>
        <div class="sim-buildmsg" id="sim-buildmsg"></div>
        <div class="sim-toolbar" id="sim-toolbar"></div>
      </div>
      <div class="sim-inspector" id="sim-inspector"></div>
    </div>
  `;

  canvas = document.getElementById('sim-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupEventListeners();
  loadSimState();
  render();
}

function resizeCanvas() {
  if (!canvas) return;
  const wrap = canvas.parentElement;
  canvas.width = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  render();
}

let dragComp = null;
let dragWire = null;
let dragOffset = { x: 0, y: 0 };
let selectedWire = null;

function setupEventListeners() {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('wheel', onWheel);
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.setAttribute('tabindex', '0');
  canvas.focus();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

const keysDown = new Set();
const MOVE_STEP = 20;

function onKeyDown(e) {
  const key = e.key.toLowerCase();
  keysDown.add(key);
  if (selectedComp && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    e.preventDefault();
    moveSelectedComp(key);
  }
}

function onKeyUp(e) {
  keysDown.delete(e.key.toLowerCase());
}

function moveSelectedComp(key) {
  if (!selectedComp) return;
  switch (key) {
    case 'w':
    case 'arrowup':
      selectedComp.y -= MOVE_STEP;
      break;
    case 's':
    case 'arrowdown':
      selectedComp.y += MOVE_STEP;
      break;
    case 'a':
    case 'arrowleft':
      selectedComp.x -= MOVE_STEP;
      break;
    case 'd':
    case 'arrowright':
      selectedComp.x += MOVE_STEP;
      break;
  }
  selectedComp.x = snapToGrid(selectedComp.x);
  selectedComp.y = snapToGrid(selectedComp.y);
  saveSimState();
  runSimulation();
}

function loadSimState() {
  const state = getState();
  if (state.simState.components.length > 0) {
    components = state.simState.components;
    wires = state.simState.wires;
  }
}

function saveSimState() {
  updateState(s => {
    s.simState.components = components;
    s.simState.wires = wires;
    s.simState.running = simRunning;
    s.simState.time = simTime;
    s.simState.speed = simSpeed;
    s.simState.mode = simMode;
  });
}

function screenToWorld(sx, sy) {
  return { x: (sx - panOffset.x) / zoom, y: (sy - panOffset.y) / zoom };
}

function worldToScreen(wx, wy) {
  return { x: wx * zoom + panOffset.x, y: wy * zoom + panOffset.y };
}

function snapToGrid(v) { return Math.round(v / 20) * 20; }

function onMouseDown(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const w = screenToWorld(sx, sy);

  if (selectedTool === 'wire') {
    const snap = findSnapPoint(w.x, w.y);
    const pt = snap ? { x: snap.x, y: snap.y } : { x: snapToGrid(w.x), y: snapToGrid(w.y) };
    if (!wireStart) {
      wireStart = pt;
    } else if (Math.hypot(pt.x - wireStart.x, pt.y - wireStart.y) > 4) {
      addWire([{ x: wireStart.x, y: wireStart.y }, { x: pt.x, y: pt.y }]);
      wireStart = null;
    } else {
      wireStart = null;
    }
  } else if (selectedTool === 'delete') {
    const comp = findComponentAt(w.x, w.y);
    if (comp) {
      removeComponent(comp.id);
    } else {
      const wire = findWireAt(w.x, w.y);
      if (wire) removeWire(wire.id);
    }
  } else if (selectedTool === 'probe') {
    placeProbe(sx, sy);
  } else {
    const comp = findComponentAt(w.x, w.y);
    if (comp) {
      selectedComp = comp;
      dragComp = comp;
      dragOffset = { x: w.x - comp.x, y: w.y - comp.y };
      if (comp.type === 'switch') {
        comp.state = { ...comp.state, closed: !comp.state?.closed };
        runSimulation();
      }
    } else {
      const wire = findWireAt(w.x, w.y);
      if (wire) {
        selectedWire = wire;
        dragWire = wire;
        dragOffset = { x: w.x, y: w.y };
      } else {
        selectedComp = null;
        selectedWire = null;
      }
    }
  }
  render();
}

// Snap a point to the nearest component lead (preferred) or wire joint,
// so wires reliably connect instead of landing a few px off.
function findSnapPoint(x, y) {
  let best = null, bestD = 18;
  for (const comp of components) {
    if (comp.type === 'wire') continue;
    for (const lead of getLeads(comp)) {
      const d = Math.hypot(lead.x - x, lead.y - y);
      if (d < bestD) { bestD = d; best = { x: lead.x, y: lead.y, kind: 'lead' }; }
    }
  }
  if (best) return best;
  bestD = 12;
  for (const wire of wires) {
    for (const p of wire.points) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) { bestD = d; best = { x: p.x, y: p.y, kind: 'joint' }; }
    }
  }
  return best;
}

function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  mousePos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  if (dragComp) {
    const w = screenToWorld(mousePos.x, mousePos.y);
    dragComp.x = snapToGrid(w.x - dragOffset.x);
    dragComp.y = snapToGrid(w.y - dragOffset.y);
  } else if (dragWire) {
    const w = screenToWorld(mousePos.x, mousePos.y);
    const dx = snapToGrid(w.x - dragOffset.x);
    const dy = snapToGrid(w.y - dragOffset.y);
    dragWire.points = dragWire.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
    dragOffset = { x: w.x, y: w.y };
  }
  render();
}

function onMouseUp() {
  if (dragComp) {
    dragComp = null;
    saveSimState();
    runSimulation();
  } else if (dragWire) {
    dragWire = null;
    saveSimState();
    runSimulation();
  }
}

function onWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  zoom = Math.max(0.3, Math.min(3, zoom * delta));
  render();
}

function onDblClick(e) {
  const rect = canvas.getBoundingClientRect();
  const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  const comp = findComponentAt(w.x, w.y);
  if (comp && comp.type !== 'wire' && comp.type !== 'ground') editComponentValue(comp);
}

function findComponentAt(x, y) {
  for (let i = components.length - 1; i >= 0; i--) {
    const comp = components[i];
    if (comp.type === 'wire') continue;
    const leads = getLeads(comp);
    for (const lead of leads) {
      if (Math.hypot(lead.x - x, lead.y - y) < 20) return comp;
    }
    if (Math.abs(x - comp.x) < 40 && Math.abs(y - comp.y) < 30) return comp;
  }
  return null;
}

function findWireAt(x, y) {
  for (let i = wires.length - 1; i >= 0; i--) {
    const wire = wires[i];
    const pts = wire.points;
    for (let j = 0; j < pts.length - 1; j++) {
      if (distToSegment(x, y, pts[j].x, pts[j].y, pts[j + 1].x, pts[j + 1].y) < 10) {
        return wire;
      }
    }
  }
  return null;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function removeWire(id) {
  wires = wires.filter(w => w.id !== id);
  saveSimState();
  runSimulation();
}

export function addComponent(type, x, y) {
  const def = COMPONENT_DEFS[type];
  if (!def) return;
  // Auto-place at canvas center with a cascade offset when no coords given,
  // so new parts never stack on top of each other.
  if (x === undefined || y === undefined) {
    const cw = canvas ? canvas.clientWidth || 600 : 600;
    const ch = canvas ? canvas.clientHeight || 400 : 400;
    const n = components.length;
    const off = (n % 8) * 24;
    x = (cw / 2 - panOffset.x) / zoom - 40 + off;
    y = (ch / 2 - panOffset.y) / zoom - 20 + off;
  }
  const comp = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type, x: snapToGrid(x), y: snapToGrid(y), rotation: 0, params: {}, state: {},
  };
  for (const p of def.params) comp.params[p.key] = def.defaultValue;
  if (type === 'switch') comp.state.closed = false;
  components.push(comp);
  selectedComp = comp;
  saveSimState();
  runSimulation();
}

function removeComponent(id) {
  components = components.filter(c => c.id !== id);
  if (selectedComp?.id === id) selectedComp = null;
  saveSimState();
  runSimulation();
}

function addWire(points) {
  if (points.length < 2) return;
  wires.push({ id: `w_${Date.now()}`, points });
  autoConnectComponents();
  saveSimState();
  runSimulation();
}

function autoConnectComponents() {
  // For each component terminal, check if it's near any wire segment
  // If so, show a prompt asking if the user wants to connect it
  for (const comp of components) {
    if (comp.type === 'wire' || comp.type === 'ground') continue;
    const leads = getLeads(comp);
    for (const lead of leads) {
      for (const wire of wires) {
        const pts = wire.points;
        for (let i = 0; i < pts.length - 1; i++) {
          if (distToSegment(lead.x, lead.y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) < 15) {
            // Terminal is near a wire - it's already connected by proximity
            // No action needed since the netlist builder handles this
            return;
          }
        }
      }
    }
  }
}

function editComponentValue(comp) {
  const def = COMPONENT_DEFS[comp.type];
  if (!def || def.params.length === 0) return;
  const param = def.params[0];
  const input = prompt(`${param.label} (${param.unit}):`, comp.params[param.key]);
  if (input !== null) {
    const val = parseValue(input);
    if (!isNaN(val)) {
      comp.params[param.key] = input;
      runSimulation();
      saveSimState();
    }
  }
}

function placeProbe(sx, sy) {
  const w = screenToWorld(sx, sy);
  const netlist = buildNetlist(components, wires);
  let nearestNet = null, minDist = Infinity;
  for (const [netId, terms] of netlist.nets) {
    for (const t of terms) {
      const comp = components.find(c => c.id === t.compId);
      if (!comp) continue;
      const leads = getLeads(comp);
      const lead = leads[t.termIdx];
      if (!lead) continue;
      const d = Math.hypot(lead.x - w.x, lead.y - w.y);
      if (d < minDist) { minDist = d; nearestNet = netId; }
    }
  }
  if (nearestNet !== null && minDist < 30) {
    if (!probes.red) probes.red = nearestNet;
    else if (!probes.black) probes.black = nearestNet;
    else { probes.red = nearestNet; probes.black = null; }
    render();
  }
}

export function setTool(tool) { selectedTool = tool; placingType = null; render(); }
export function setPlacingType(type) { placingType = type; selectedTool = 'place'; render(); }
export function getViewMode() { return viewMode; }
export function selectComponent(id) {
  selectedComp = components.find(c => c.id === id) || null;
  saveSimState();
  render();
}
export async function setViewMode(mode) {
  viewMode = mode;
  const c2d = document.getElementById('sim-canvas');
  const c3d = document.getElementById('sim-3d');
  if (mode === '3d') {
    if (c2d) c2d.style.display = 'none';
    if (c3d) {
      c3d.style.display = 'block';
      if (!sim3dMod) sim3dMod = await import('./sim3d.js');
      sim3dMod.start3D(c3d);
    }
  } else {
    if (sim3dMod) sim3dMod.stop3D();
    if (c3d) c3d.style.display = 'none';
    if (c2d) { c2d.style.display = 'block'; resizeCanvas(); }
  }
  render();
}

export function runSimulation() {
  const netlist = buildNetlist(components, wires);
  simErrors = netlist.errors;
  simWarnings = netlist.warnings;
  if (netlist.errors.length > 0) {
    dcSolution = null; transientData = null;
    updateSimStatus('error'); render(); return;
  }
  if (simMode === 'dc') {
    dcSolution = solveDC(components, wires, netlist);
    transientData = null;
  } else {
    transientData = solveTransient(components, wires, netlist, { tMax: simTmax, dt: simDt });
    dcSolution = null;
  }
  lastSimTime = performance.now();
  updateSimStatus('ready');
  render();
}

export function toggleSimulation() {
  if (!simRunning) runSimulation();
  simRunning = !simRunning;
  if (simRunning) simLoop();
  else cancelAnimationFrame(animFrame);
  updateSimStatus(simRunning ? 'running' : 'ready');
  render();
}

function simLoop() {
  if (!simRunning) return;
  const now = performance.now();
  const dt = (now - lastSimTime) / 1000;
  lastSimTime = now;
  simTime += dt * simSpeed;
  if (simMode === 'transient' && transientData) updateScopeData(dt * simSpeed);
  render();
  animFrame = requestAnimationFrame(simLoop);
}

function updateScopeData(dt) {
  if (!scopeRecording) return;
  scopeTime += dt;
  if (scopeTime > scopeMaxTime) { scopeTime = 0; scopeTimePoints = []; scopeNodeHistory.clear(); }
  const netlist = buildNetlist(components, wires);
  for (let ch = 0; ch < 4; ch++) {
    if (!scopeEnabled[ch] || scopeChannels[ch] === null) continue;
    const sol = solveDC(components, wires, netlist);
    if (sol.ok) {
      const v = sol.nodeVoltages.get(scopeChannels[ch]) ?? 0;
      if (!scopeNodeHistory.has(ch)) scopeNodeHistory.set(ch, []);
      scopeNodeHistory.get(ch).push(v);
    }
  }
  scopeTimePoints.push(scopeTime);
}

function updateSimStatus(status) {
  const dot = document.querySelector('.status-dot');
  const text = document.querySelector('.status-text');
  if (!dot || !text) return;
  dot.className = `status-dot ${status}`;
  text.textContent = status === 'running' ? 'Simulating...' : status === 'error' ? 'Error' : 'Ready';
}

export function resetSimulation() { simRunning = false; cancelAnimationFrame(animFrame); simTime = 0; runSimulation(); }
export function stepSimulation() { if (simMode !== 'transient') return; simTime += simDt * simSpeed; runSimulation(); }
export function setSimSpeed(speed) { simSpeed = speed; saveSimState(); }
export function setSimMode(mode) { simMode = mode; runSimulation(); saveSimState(); }
export function setSimTmax(tmax) { simTmax = tmax; runSimulation(); }
export function setSimDt(dt) { simDt = dt; runSimulation(); }
export function setScopeVdiv(v) { scopeVdiv = v; render(); }
export function setScopeTdiv(t) { scopeTdiv = t; render(); }
export function setScopeChannel(ch, node) { scopeChannels[ch] = node; render(); }
export function setScopeEnabled(ch, enabled) { scopeEnabled[ch] = enabled; render(); }

function render() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid(); drawWires(); drawComponents(); drawProbes(); drawWirePreview();
  updateInspector(); updateToolbar();
  ensureLedAnim();
  if (viewMode === '3d' && sim3dMod) sim3dMod.refresh3D();
}

function drawGrid() {
  ctx.strokeStyle = '#111827'; ctx.lineWidth = 1;
  const step = 20 * zoom;
  const ox = panOffset.x % step, oy = panOffset.y % step;
  for (let x = ox; x < canvas.width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
  for (let y = oy; y < canvas.height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
}

function compCurrent(comp) {
  if (!dcSolution || !dcSolution.ok) return 0;
  return dcSolution.branchCurrents.get(comp.id) ?? 0;
}

let ledRafId = 0;
function ensureLedAnim() {
  if (ledRafId) return;
  if (!dcSolution || !dcSolution.ok) return;
  const on = components.some(c => c.type === 'led' && Math.abs(compCurrent(c)) > 0.002);
  if (!on) return;
  ledRafId = requestAnimationFrame(() => {
    ledRafId = 0;
    setTimeout(() => { if (viewMode === '2d') render(); }, 90);
  });
}

function wireVoltage(wire, netlist) {
  if (!dcSolution || !dcSolution.ok || !netlist || wire.points.length === 0) return null;
  const p = wire.points[0];
  let bestNet = null, bestD = 14;
  for (const comp of components) {
    if (comp.type === 'wire' || comp.type === 'ground') continue;
    const leads = getLeads(comp);
    for (let ti = 0; ti < leads.length; ti++) {
      const d = Math.hypot(leads[ti].x - p.x, leads[ti].y - p.y);
      if (d < bestD) {
        bestD = d;
        for (const [netId, terms] of netlist.nets) {
          if (terms.some(t => t.compId === comp.id && t.termIdx === ti)) bestNet = netId;
        }
      }
    }
  }
  if (bestNet === null) return null;
  return dcSolution.nodeVoltages.get(bestNet) ?? null;
}

function voltageColor(v, vmax) {
  if (v === null || !(vmax > 0)) return '#4a5568';
  const t = Math.max(-1, Math.min(1, v / vmax));
  if (Math.abs(t) < 0.04) return '#4a5568';
  // positive: amber glow, negative: blue glow, intensity scales with |V|
  const warmth = Math.round(158 - 60 * Math.abs(t));
  return t > 0 ? `rgb(245,${warmth},11)` : `rgb(59,130,246)`;
}

function drawWires() {
  ctx.lineCap = 'round';
  let vmax = 0;
  let netlist = null;
  if (dcSolution && dcSolution.ok) {
    netlist = buildNetlist(components, wires);
    for (const v of dcSolution.nodeVoltages.values()) vmax = Math.max(vmax, Math.abs(v));
  }
  for (const wire of wires) {
    if (wire.points.length < 2) continue;
    const col = (dcSolution && dcSolution.ok && netlist) ? voltageColor(wireVoltage(wire, netlist), vmax) : '#4a5568';
    ctx.strokeStyle = col;
    ctx.lineWidth = col === '#4a5568' ? 2 : 2.5;
    ctx.shadowColor = col === '#4a5568' ? 'transparent' : col;
    ctx.shadowBlur = col === '#4a5568' ? 0 : 6;
    ctx.beginPath();
    const p0 = worldToScreen(wire.points[0].x, wire.points[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < wire.points.length; i++) {
      const p = worldToScreen(wire.points[i].x, wire.points[i].y);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function drawComponents() {
  for (const comp of components) {
    const pos = worldToScreen(comp.x, comp.y);
    ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate((comp.rotation || 0) * Math.PI / 2);
    if (selectedComp?.id === comp.id) { ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 10; }
    drawComponentBody(comp);
    ctx.restore();
    ctx.fillStyle = '#8892a8'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(COMPONENT_DEFS[comp.type]?.name ?? comp.type, pos.x, pos.y + 35);
    const def = COMPONENT_DEFS[comp.type];
    if (def && def.params.length > 0) {
      const param = def.params[0];
      ctx.fillStyle = '#00d4ff'; ctx.font = '11px "Cascadia Code", monospace';
      ctx.fillText(`${comp.params[param.key]}${param.unit}`, pos.x, pos.y + 48);
    }
    if (dcSolution && dcSolution.ok) {
      const I = dcSolution.branchCurrents.get(comp.id);
      const P = dcSolution.powers.get(comp.id);
      if (I !== undefined && Math.abs(I) > 1e-9) { ctx.fillStyle = '#22c55e'; ctx.font = '10px "Cascadia Code", monospace'; ctx.fillText(`I=${formatValue(I, 'A')}`, pos.x, pos.y - 35); }
      if (P !== undefined && Math.abs(P) > 1e-6) { ctx.fillStyle = '#f59e0b'; ctx.fillText(`P=${formatValue(P, 'W')}`, pos.x, pos.y - 48); }
    }
  }
}

function drawComponentBody(comp) {
  switch (comp.type) {
    case 'dc_source': drawDCSource(); break;
    case 'resistor': drawResistor(); break;
    case 'capacitor': drawCapacitor(); break;
    case 'led': drawLED(comp); break;
    case 'diode': drawDiode(comp); break;
    case 'switch': drawSwitch(comp); break;
    case 'ground': drawGround(); break;
    default: ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 2; ctx.strokeRect(-15, -10, 30, 20);
  }
}

function drawDCSource() {
  const grad = ctx.createLinearGradient(0, -18, 0, 18);
  grad.addColorStop(0, '#0e7490');
  grad.addColorStop(1, '#083344');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2;
  ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e0faff'; ctx.font = 'bold 14px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('+', 0, -6); ctx.fillText('−', 0, 8);
  ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-18, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(40, 0); ctx.stroke();
}

function drawResistor() {
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-22, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(40, 0); ctx.stroke();
  // premium body: metallic gradient capsule with color bands
  const grad = ctx.createLinearGradient(0, -9, 0, 9);
  grad.addColorStop(0, '#e8c15a');
  grad.addColorStop(0.5, '#b8862f');
  grad.addColorStop(1, '#7c5a1c');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#f3d27a'; ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(232,193,90,0.5)'; ctx.shadowBlur = 6;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-22, -9, 44, 18, 8); else ctx.rect(-22, -9, 44, 18);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  const bands = ['#1e293b', '#b91c1c', '#1d4ed8', '#d4a017'];
  bands.forEach((b, i) => {
    ctx.fillStyle = b;
    ctx.fillRect(-14 + i * 9, -9, 4, 18);
  });
}

function drawCapacitor() {
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-6, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(40, 0); ctx.stroke();
  const grad = ctx.createLinearGradient(-6, 0, 6, 0);
  grad.addColorStop(0, '#3b82f6');
  grad.addColorStop(1, '#93c5fd');
  ctx.fillStyle = grad;
  ctx.shadowColor = 'rgba(59,130,246,0.6)'; ctx.shadowBlur = 6;
  ctx.fillRect(-6, -13, 4, 26);
  ctx.fillRect(2, -13, 4, 26);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 1;
  ctx.strokeRect(-6, -13, 4, 26);
  ctx.strokeRect(2, -13, 4, 26);
}

function drawLED(comp) {
  // LED: lens circle + hollow triangle + emission rays (always visible, dim when off).
  const I = Math.abs(compCurrent(comp));
  const on = I > 0.002;
  const pulse = on ? 0.65 + 0.35 * Math.sin(performance.now() / 140) : 0;
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-16, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(40, 0); ctx.stroke();
  // lens
  const lensGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 18);
  if (on) { lensGrad.addColorStop(0, '#fecaca'); lensGrad.addColorStop(1, 'rgba(239,68,68,0.15)'); }
  else { lensGrad.addColorStop(0, '#1f2937'); lensGrad.addColorStop(1, 'rgba(31,41,55,0.1)'); }
  ctx.fillStyle = lensGrad;
  ctx.strokeStyle = on ? '#ef4444' : '#64748b'; ctx.lineWidth = 2;
  ctx.shadowColor = on ? '#ef4444' : 'transparent';
  ctx.shadowBlur = on ? 10 + 8 * pulse : 0;
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  // hollow triangle + bar
  ctx.beginPath(); ctx.moveTo(-13, -9); ctx.lineTo(-13, 9); ctx.lineTo(13, 0); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(13, -9); ctx.lineTo(13, 9); ctx.stroke();
  // emission rays
  ctx.strokeStyle = on ? '#fca5a5' : '#475569';
  ctx.globalAlpha = on ? 0.5 + 0.5 * pulse : 0.35;
  ctx.lineWidth = on ? 2 : 1.5;
  ctx.shadowColor = on ? '#ef4444' : 'transparent';
  ctx.shadowBlur = on ? 6 + 6 * pulse : 0;
  ctx.beginPath(); ctx.moveTo(-2, -19); ctx.lineTo(8, -27); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, -19); ctx.lineTo(18, -27); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawDiode(comp) {
  // Standard diode: SOLID amber triangle + bar — clearly different from the LED lens.
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-14, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(40, 0); ctx.stroke();
  const I = Math.abs(compCurrent(comp));
  const grad = ctx.createLinearGradient(0, -10, 0, 10);
  grad.addColorStop(0, '#fcd34d');
  grad.addColorStop(1, '#b45309');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
  ctx.shadowColor = I > 0.002 ? '#f59e0b' : 'transparent';
  ctx.shadowBlur = I > 0.002 ? 8 : 0;
  ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(-14, 10); ctx.lineTo(14, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, -11); ctx.lineTo(14, 11); ctx.stroke();
}

function drawSwitch(comp) {
  const closed = comp.state?.closed ?? false;
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-16, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(40, 0); ctx.stroke();
  // premium contact pads
  ctx.fillStyle = closed ? '#22c55e' : '#64748b';
  ctx.shadowColor = closed ? '#22c55e' : 'transparent';
  ctx.shadowBlur = closed ? 6 : 0;
  for (const s of [-16, 16]) { ctx.beginPath(); ctx.arc(s, 0, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.shadowBlur = 0;
  const grad = ctx.createLinearGradient(0, -3, 0, 3);
  grad.addColorStop(0, '#e2e8f0');
  grad.addColorStop(1, '#64748b');
  ctx.strokeStyle = grad; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(closed ? 16 : 12, closed ? 0 : -13); ctx.stroke();
}

function drawGround() {
  const grad = ctx.createLinearGradient(0, -20, 0, 12);
  grad.addColorStop(0, '#94a3b8');
  grad.addColorStop(1, '#475569');
  ctx.strokeStyle = grad; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(0, 0); ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-10, 5.5); ctx.lineTo(10, 5.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5, 11); ctx.lineTo(5, 11); ctx.stroke();
}

function drawProbes() {
  const netlist = buildNetlist(components, wires);
  for (const [color, netId] of [['#ef4444', probes.red], ['#1f2937', probes.black]]) {
    if (netId === null) continue;
    const terms = netlist.nets.get(netId);
    if (!terms || terms.length === 0) continue;
    const comp = components.find(c => c.id === terms[0].compId);
    if (!comp) continue;
    const leads = getLeads(comp);
    const lead = leads[terms[0].termIdx];
    if (!lead) continue;
    const pos = worldToScreen(lead.x, lead.y);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2); ctx.fill();
    if (color === '#1f2937') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); }
  }
}

function drawWirePreview() {
  if (selectedTool === 'wire' && wireStart) {
    const w = screenToWorld(mousePos.x, mousePos.y);
    const snap = findSnapPoint(w.x, w.y);
    const end = snap ? worldToScreen(snap.x, snap.y) : mousePos;
    const start = worldToScreen(wireStart.x, wireStart.y);
    ctx.strokeStyle = snap ? '#22c55e' : '#00d4ff';
    ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.setLineDash([]);
    if (snap) {
      // magnetic snap ring: green = lead, cyan = wire joint
      ctx.strokeStyle = snap.kind === 'lead' ? '#22c55e' : '#00d4ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(end.x, end.y, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = snap.kind === 'lead' ? '#22c55e' : '#00d4ff';
      ctx.beginPath(); ctx.arc(end.x, end.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function updateInspector() {
  const panel = document.getElementById('sim-inspector');
  if (!panel) return;
  let html = '<div class="card"><div class="card-header"><span class="card-title">Inspector</span></div>';
  if (selectedComp) {
    const def = COMPONENT_DEFS[selectedComp.type];
    html += `<div class="notebook-field"><label>Type</label><div>${def?.name ?? selectedComp.type}</div></div>`;
    if (def && def.params.length > 0) {
      for (const param of def.params) {
        html += `<div class="notebook-field"><label>${param.label} (${param.unit})</label>`;
        html += `<input type="text" value="${selectedComp.params[param.key]}" onchange="window.nexlabUpdateParam('${selectedComp.id}', '${param.key}', this.value)" style="width:100%"></div>`;
      }
    }
    if (dcSolution && dcSolution.ok) {
      const I = dcSolution.branchCurrents.get(selectedComp) ?? 0;
      const P = dcSolution.powers.get(selectedComp) ?? 0;
      html += `<div class="notebook-field"><label>Current</label><div class="mono text-success">${formatValue(I, 'A')}</div></div>`;
      html += `<div class="notebook-field"><label>Power</label><div class="mono text-warning">${formatValue(P, 'W')}</div></div>`;
    }
  } else {
    html += '<p class="text-muted" style="font-size:12px">Select a component to inspect.</p>';
  }
  html += '<div class="notebook-field"><label>Probes</label><div style="display:flex;gap:8px;align-items:center">';
  html += '<span style="color:#ef4444">●</span><span style="font-size:11px">' + (probes.red !== null ? 'Net ' + probes.red : 'Not placed') + '</span>';
  html += '<span style="color:#1f2937;margin-left:8px">●</span><span style="font-size:11px">' + (probes.black !== null ? 'Net ' + probes.black : 'Not placed') + '</span></div></div>';
  if (probes.red !== null && probes.black !== null && dcSolution && dcSolution.ok) {
    const V = (dcSolution.nodeVoltages.get(probes.red) ?? 0) - (dcSolution.nodeVoltages.get(probes.black) ?? 0);
    html += '<div class="instrument-display" style="font-size:20px">' + formatValue(V, 'V') + '</div>';
  }
  if (simErrors.length > 0) {
    html += '<div class="notebook-field"><label class="text-danger">Errors</label>';
    for (const err of simErrors) html += `<div class="text-danger" style="font-size:11px">⚠ ${err}</div>`;
    html += '</div>';
  }
  html += '</div>';
  panel.innerHTML = html;
}

function updateToolbar() {
  const toolbar = document.getElementById('sim-toolbar');
  if (!toolbar) return;
  toolbar.innerHTML = `
    <button class="btn ${simRunning ? 'active' : ''}" onclick="window.nexlabToggleSim()">${simRunning ? '⏸' : '▶'} ${simRunning ? 'Pause' : 'Run'}</button>
    <button class="btn" onclick="window.nexlabResetSim()">⟳ Reset</button>
    <button class="btn" onclick="window.nexlabStepSim()">⏭ Step</button>
    <button class="btn ${simMode === 'dc' ? 'active' : ''}" onclick="window.nexlabSetMode('dc')">DC</button>
    <button class="btn ${simMode === 'transient' ? 'active' : ''}" onclick="window.nexlabSetMode('transient')">Transient</button>
    <button class="btn ${viewMode === '2d' ? 'active' : ''}" onclick="window.nexlabSetView('2d')">2D</button>
    <button class="btn ${viewMode === '3d' ? 'active' : ''}" onclick="window.nexlabSetView('3d')">3D</button>
    <button class="btn" onclick="window.nexlabSetSpeed(${simSpeedOptions[(simSpeedIndex + 1) % simSpeedOptions.length]})">Speed: ${simSpeed}×</button>
    <button class="btn btn-danger" onclick="window.nexlabDestroy()">🗑 Destroy</button>
  `;
}

export function destroyCircuit() {
  components = [];
  wires = [];
  selectedComp = null;
  selectedWire = null;
  dragComp = null;
  dragWire = null;
  wireStart = null;
  dcSolution = null;
  transientData = null;
  simErrors = [];
  simWarnings = [];
  saveSimState();
  render();
}

export function getComponents() { return components; }
export function getWires() { return wires; }
export function getDCSolution() { return dcSolution; }
export function getTransientData() { return transientData; }
export function getSimTime() { return simTime; }
export function getSimRunning() { return simRunning; }
export function getProbes() { return probes; }
export function getScopeData() { return { timePoints: scopeTimePoints, nodeHistory: scopeNodeHistory }; }
export function getScopeChannels() { return scopeChannels; }
export function getScopeEnabled() { return scopeEnabled; }
export function getScopeColors() { return scopeColors; }
export function getScopeVdiv() { return scopeVdiv; }
export function getScopeTdiv() { return scopeTdiv; }
export function getSimErrors() { return simErrors; }
export function getSimWarnings() { return simWarnings; }
export function getSimMode() { return simMode; }
export function getSimSpeed() { return simSpeed; }
export function getSimTmax() { return simTmax; }
export function getSimDt() { return simDt; }
export function getScopeTime() { return scopeTime; }
export function getScopeMaxTime() { return scopeMaxTime; }
export function getScopeDt() { return scopeDt; }
export function getScopeRecording() { return scopeRecording; }
export function getScopeNodeHistory() { return scopeNodeHistory; }
export function getScopeTimePoints() { return scopeTimePoints; }

export function setComponentValue(compId, key, value) {
  const comp = components.find(c => c.id === compId);
  if (comp) { comp.params[key] = value; runSimulation(); saveSimState(); }
}

export function buildFromDescription(text) {
  const input = document.getElementById('sim-build-input');
  const msg = document.getElementById('sim-buildmsg');
  const req = (text ?? input?.value ?? '').trim();
  if (!req) return { ok: false };
  const res = buildCircuitFromText(req);
  if (res.ok) {
    loadExperimentSetup(res.setup);
    if (msg) msg.innerHTML = `<span class="text-success">Built ${res.title}.</span> <span class="text-muted">${res.explanation}</span>`;
  } else {
    if (msg) msg.innerHTML = `<span class="text-danger">${res.error}</span><br><span class="text-muted">${res.suggestions}</span>`;
  }
  return res;
}

export function clearProbes() { probes = { red: null, black: null }; render(); }

export function exportCircuit() { return serializeCircuit(components, wires); }

export function importCircuit(json) {
  try {
    const data = deserializeCircuit(json);
    components = data.components; wires = data.wires;
    runSimulation(); saveSimState(); render();
  } catch (e) { console.error('Failed to import circuit:', e); }
}

export function clearCircuit() {
  components = []; wires = []; selectedComp = null;
  probes = { red: null, black: null };
  dcSolution = null; transientData = null;
  simErrors = []; simWarnings = [];
  saveSimState(); render();
}

export function loadExperimentSetup(setup) {
  components = structuredClone(setup.components);
  wires = structuredClone(setup.wires);
  selectedComp = null; probes = { red: null, black: null };
  dcSolution = null; transientData = null;
  runSimulation(); saveSimState(); render();
}

export function injectFault(faultType, componentId) {
  const comp = components.find(c => c.id === componentId);
  if (!comp) return;
  faultActive = faultType; faultComponent = componentId;
  switch (faultType) {
    case 'open': comp.state = { ...comp.state, faulty: true, open: true }; break;
    case 'short': comp.state = { ...comp.state, faulty: true, short: true }; break;
    case 'value-drift':
      if (comp.type === 'resistor') { const current = parseValue(comp.params.resistance); comp.params.resistance = String(current * 10); }
      comp.state = { ...comp.state, faulty: true }; break;
    case 'reversed': comp.rotation = ((comp.rotation || 0) + 2) % 4; comp.state = { ...comp.state, faulty: true }; break;
  }
  runSimulation(); render();
}

export function clearFault() {
  if (faultComponent) {
    const comp = components.find(c => c.id === faultComponent);
    if (comp) comp.state = { ...comp.state, faulty: false, open: false, short: false };
  }
  faultActive = null; faultComponent = null;
  runSimulation(); render();
}

export function getFaultState() { return { active: faultActive, component: faultComponent }; }

export function startScopeRecording() { scopeRecording = true; scopeTime = 0; scopeTimePoints = []; scopeNodeHistory.clear(); }
export function stopScopeRecording() { scopeRecording = false; }
export function resetScope() { scopeTime = 0; scopeTimePoints = []; scopeNodeHistory.clear(); render(); }

export function getScopeStats() {
  const stats = new Map();
  for (let ch = 0; ch < 4; ch++) {
    if (!scopeEnabled[ch]) continue;
    const data = scopeNodeHistory.get(ch);
    if (!data || data.length === 0) continue;
    const min = Math.min(...data), max = Math.max(...data);
    const mean = data.reduce((s, v) => s + v, 0) / data.length;
    const vpp = max - min;
    const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
    let crossings = 0;
    for (let i = 1; i < data.length; i++) { if ((data[i - 1] < mean && data[i] >= mean) || (data[i - 1] >= mean && data[i] < mean)) crossings++; }
    const duration = scopeTimePoints.length > 1 ? scopeTimePoints[scopeTimePoints.length - 1] - scopeTimePoints[0] : 1;
    const freq = crossings / (2 * duration);
    stats.set(ch, { min, max, mean, vpp, rms, freq });
  }
  return stats;
}

export function addBranch(name, circuitJson) { branchHistory.push({ name, circuit: circuitJson, timestamp: Date.now() }); }
export function getBranches() { return branchHistory; }
export function setHintLevel(level) { hintLevel = level; }
export function getHintLevel() { return hintLevel; }
export function setCurrentExperiment(exp) { currentExperiment = exp; }
export function getCurrentExperiment() { return currentExperiment; }
export function setExperimentStep(step) { experimentStep = step; }
export function getExperimentStep() { return experimentStep; }
export function setPredictionValue(val) { predictionValue = val; }
export function getPredictionValue() { return predictionValue; }
export function setPredictionResult(res) { predictionResult = res; }
export function getPredictionResult() { return predictionResult; }
export function addMentorMessage(msg) { mentorMessages.push(msg); }
export function getMentorMessages() { return mentorMessages; }
export function setNotebookEntry(entry) { notebookEntry = entry; }
export function getNotebookEntry() { return notebookEntry; }
