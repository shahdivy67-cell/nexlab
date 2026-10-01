// NexLab — 3D circuit view (Three.js).
// Orbit navigation, click-component-for-info, current-flow particles
// (speed scales with real branch current), exploded-view slider.
// Pure mapping helpers are exported for unit testing.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getComponents, getWires, getDCSolution, selectComponent } from './simulator.js?v=7';
import { COMPONENT_DEFS, formatValue } from '../engine/components.js';
import { getLeads } from '../engine/circuit.js?v=5';

// 2D canvas coords (x right, y down, px) -> 3D (x right, z towards viewer)
export function w2v(x, y, h = 0) {
  return [x, h, y];
}

export function polyLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][2] - pts[i][2]);
  }
  return L;
}

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let rafId = 0;
let active = false;
let container = null;
let compGroup = null;
let wireGroup = null;
let boardGroup = null;
let labelGroup = null;
let flowPoints = null;
let flowData = [];
let flowVisible = true;
let explodeFactor = 0;
let compMeshes = []; // { group, comp, mats }
let downPos = null;

const WIRE_Y = 2;
const BODY_Y = 6;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.35, ...opts });
}

function makeLabelSprite(line1, line2) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 80;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,23,0.85)';
  g.fillRect(0, 0, 256, 80);
  g.strokeStyle = '#1e2a42';
  g.strokeRect(1, 1, 254, 78);
  g.fillStyle = '#e2e8f0';
  g.font = '600 24px Inter, sans-serif';
  g.textAlign = 'center';
  g.fillText(line1.slice(0, 18), 128, 32);
  g.fillStyle = '#00d4ff';
  g.font = '20px monospace';
  g.fillText((line2 || '').slice(0, 20), 128, 60);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(64, 20, 1);
  return sp;
}

function valueText(comp) {
  const def = COMPONENT_DEFS[comp.type];
  if (!def || def.params.length === 0) return '';
  const p = def.params[0];
  return `${comp.params[p.key]}${p.unit}`;
}

function branchCurrent(compId) {
  const sol = getDCSolution();
  if (!sol || !sol.ok) return 0;
  return sol.branchCurrents.get(compId) ?? 0;
}

function buildBody(comp) {
  const g = new THREE.Group();
  const silver = mat(0x8892a8, { metalness: 0.8, roughness: 0.3 });
  switch (comp.type) {
    case 'resistor': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(26, 9, 9), mat(0xc9a227));
      body.position.y = BODY_Y;
      g.add(body);
      for (const s of [-1, 1]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 6, 12), silver);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(s * 16, BODY_Y, 0);
        g.add(cap);
      }
      break;
    }
    case 'dc_source': {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 18, 24), mat(0x0e7490));
      body.position.y = 9;
      g.add(body);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 2, 24), silver);
      top.position.y = 19;
      g.add(top);
      break;
    }
    case 'capacitor': {
      for (const s of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(2.5, 14, 14), mat(0x3b82f6));
        plate.position.set(s * 4, 9, 0);
        g.add(plate);
      }
      break;
    }
    case 'led':
    case 'diode': {
      const isLed = comp.type === 'led';
      const I = Math.abs(branchCurrent(comp.id));
      const glow = Math.min(1, I / 0.02);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(7, 20, 16),
        new THREE.MeshStandardMaterial({
          color: isLed ? 0xff6b6b : 0x8892a8,
          emissive: isLed ? 0xff2222 : 0x000000,
          emissiveIntensity: isLed ? 0.2 + 2.2 * glow : 0,
          roughness: 0.25, metalness: 0.1,
        })
      );
      bulb.position.y = 10;
      g.add(bulb);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 4, 12), silver);
      base.position.y = 2;
      g.add(base);
      break;
    }
    case 'switch': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(30, 4, 10), mat(0x1a2236));
      base.position.y = 2;
      g.add(base);
      const closed = comp.state?.closed ?? false;
      const lever = new THREE.Mesh(new THREE.BoxGeometry(26, 3, 4), silver);
      lever.position.set(closed ? 0 : -3, closed ? 6 : 10, 0);
      lever.rotation.z = closed ? 0 : -0.5;
      g.add(lever);
      break;
    }
    case 'ground': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 14, 8), silver);
      stem.position.y = 9;
      g.add(stem);
      [16, 11, 6].forEach((w, i) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, 3), silver);
        bar.position.y = 3 + i * 3.4;
        g.add(bar);
      });
      break;
    }
    default: {
      const body = new THREE.Mesh(new THREE.BoxGeometry(24, 8, 10), mat(0x4a5568));
      body.position.y = BODY_Y;
      g.add(body);
    }
  }
  // pins down to the board at each lead
  for (const lead of getLeads(comp)) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, BODY_Y, 8), silver);
    pin.position.set(lead.x - comp.x, BODY_Y / 2, lead.y - comp.y);
    g.add(pin);
  }
  return g;
}

function disposeGroup(gr) {
  gr.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

function buildBoard() {
  if (boardGroup) { scene.remove(boardGroup); disposeGroup(boardGroup); }
  boardGroup = new THREE.Group();
  const comps = getComponents();
  const wires = getWires();
  let xs = [], zs = [];
  for (const c of comps) { xs.push(c.x); zs.push(c.y); }
  for (const w of wires) for (const p of w.points) { xs.push(p.x); zs.push(p.y); }
  let cx = 200, cz = 200, w = 500, d = 400;
  if (xs.length > 0) {
    const x0 = Math.min(...xs) - 70, x1 = Math.max(...xs) + 70;
    const z0 = Math.min(...zs) - 70, z1 = Math.max(...zs) + 70;
    cx = (x0 + x1) / 2; cz = (z0 + z1) / 2;
    w = Math.max(200, x1 - x0); d = Math.max(200, z1 - z0);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), mat(0x151b2b, { roughness: 0.9, metalness: 0.1 }));
  slab.position.set(cx, -1.5, cz);
  boardGroup.add(slab);
  const size = Math.max(w, d) + 60;
  const grid = new THREE.GridHelper(size, Math.round(size / 20), 0x1e2a42, 0x16203a);
  grid.position.set(cx, 0.2, cz);
  boardGroup.add(grid);
  scene.add(boardGroup);
  return { cx, cz };
}

function buildComponents() {
  if (compGroup) { scene.remove(compGroup); disposeGroup(compGroup); }
  if (labelGroup) { scene.remove(labelGroup); disposeGroup(labelGroup); }
  compGroup = new THREE.Group();
  labelGroup = new THREE.Group();
  compMeshes = [];
  const comps = getComponents();
  comps.forEach((comp, idx) => {
    const grp = new THREE.Group();
    grp.position.set(comp.x, idx * 16 * explodeFactor, comp.y);
    grp.rotation.y = (comp.rotation || 0) * Math.PI / 2;
    const body = buildBody(comp);
    grp.add(body);
    grp.traverse(o => { o.userData.compId = comp.id; });
    const def = COMPONENT_DEFS[comp.type];
    const label = makeLabelSprite(def?.name ?? comp.type, valueText(comp));
    label.position.set(0, 30, 0);
    grp.add(label);
    compGroup.add(grp);
    compMeshes.push({ group: grp, comp, idx });
  });
  scene.add(compGroup);
}

function collectPaths() {
  // Particle paths: every wire polyline + a straight segment through each 2-lead part.
  const paths = [];
  for (const w of getWires()) {
    if (w.points.length < 2) continue;
    paths.push(w.points.map(p => new THREE.Vector3(p.x, WIRE_Y, p.y)));
  }
  for (const c of getComponents()) {
    const leads = getLeads(c);
    if (leads.length === 2) {
      paths.push([
        new THREE.Vector3(leads[0].x, BODY_Y, leads[0].y),
        new THREE.Vector3(leads[1].x, BODY_Y, leads[1].y),
      ]);
    }
  }
  return paths;
}

function buildWiresAndFlow() {
  if (wireGroup) { scene.remove(wireGroup); disposeGroup(wireGroup); }
  wireGroup = new THREE.Group();
  const copper = mat(0xb87333, { metalness: 0.85, roughness: 0.3 });
  for (const w of getWires()) {
    if (w.points.length < 2) continue;
    const pts = w.points.map(p => new THREE.Vector3(p.x, WIRE_Y, p.y));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), 1.2, 6, false), copper);
    wireGroup.add(tube);
  }
  scene.add(wireGroup);

  // flow particles
  if (flowPoints) { scene.remove(flowPoints); flowPoints.geometry.dispose(); flowPoints.material.dispose(); flowPoints = null; }
  flowData = [];
  const sol = getDCSolution();
  let imax = 0;
  if (sol && sol.ok) {
    for (const I of sol.branchCurrents.values()) imax = Math.max(imax, Math.abs(I));
  }
  const paths = collectPaths();
  const speed = 20 + 160 * Math.min(1, imax / 0.1);
  if (flowVisible && imax > 1e-9) {
    let positions = [];
    for (const path of paths) {
      const L = polyLength(path.map(v => [v.x, 0, v.z]));
      const n = Math.max(2, Math.min(40, Math.floor(L / 18)));
      for (let i = 0; i < n; i++) {
        flowData.push({ path, dist: (i / n) * L, len: L, speed });
        positions.push(0, 0, 0);
      }
    }
    if (flowData.length > 0) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      flowPoints = new THREE.Points(geo, new THREE.PointsMaterial({
        color: 0x00d4ff, size: 4, sizeAttenuation: true,
        transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      scene.add(flowPoints);
    }
  }
}

function pointOnPath(path, dist) {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = path[i].distanceTo(path[i + 1]);
    if (dist <= acc + seg) {
      const t = seg === 0 ? 0 : (dist - acc) / seg;
      return path[i].clone().lerp(path[i + 1], t);
    }
    acc += seg;
  }
  return path[path.length - 1].clone();
}

function tick(dt) {
  if (flowPoints && flowData.length > 0) {
    const arr = flowPoints.geometry.attributes.position.array;
    for (let i = 0; i < flowData.length; i++) {
      const p = flowData[i];
      p.dist = (p.dist + p.speed * dt) % p.len;
      const v = pointOnPath(p.path, p.dist);
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
    }
    flowPoints.geometry.attributes.position.needsUpdate = true;
  }
  // exploded lift follows slider live
  for (const { group, idx } of compMeshes) {
    group.position.y += ((idx * 16 * explodeFactor) - group.position.y) * Math.min(1, dt * 8);
  }
}

function onPointerDown(e) {
  downPos = [e.clientX, e.clientY];
}

function onPointerUp(e) {
  if (!downPos) return;
  const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
  downPos = null;
  if (moved > 5 || !renderer) return;
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(mouse, camera);
  const hits = ray.intersectObjects(compGroup.children, true);
  if (hits.length > 0 && hits[0].object.userData.compId) {
    selectComponent(hits[0].object.userData.compId);
  }
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.className = 'sim3d-panel';
  panel.innerHTML = `
    <div class="sim3d-row"><span>Exploded view</span><input id="sim3d-explode" type="range" min="0" max="100" value="0"></div>
    <div class="sim3d-row"><span>Current flow</span><input id="sim3d-flow" type="checkbox" checked></div>
    <div class="sim3d-hint">Drag to orbit · scroll to zoom · click a part for info</div>
  `;
  container.appendChild(panel);
  panel.querySelector('#sim3d-explode').addEventListener('input', e => {
    explodeFactor = e.target.value / 100;
  });
  panel.querySelector('#sim3d-flow').addEventListener('change', e => {
    flowVisible = e.target.checked;
    refresh3D();
  });
}

export function start3D(host) {
  stop3D();
  container = host;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    host.innerHTML = '<div style="padding:24px;color:#ef4444">WebGL is not available in this browser, 3D view needs WebGL.</div>';
    return false;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.domElement.className = 'sim3d-canvas';
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 1.4);
  dir.position.set(200, 320, 140);
  scene.add(dir);
  buildPanel();
  const { cx, cz } = buildBoard();
  camera.position.set(cx, 300, cz + 380);
  controls.target.set(cx, 0, cz);
  refresh3D();
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointerup', onPointerUp);
  active = true;
  let last = performance.now();
  const loop = now => {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const w = host.clientWidth, h = host.clientHeight;
    if (w > 0 && h > 0 && (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio()))) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    controls.update();
    tick(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
  return true;
}

export function refresh3D() {
  if (!active || !scene) return;
  buildBoard();
  buildComponents();
  buildWiresAndFlow();
}

export function stop3D() {
  active = false;
  cancelAnimationFrame(rafId);
  if (renderer) {
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    renderer.domElement.removeEventListener('pointerup', onPointerUp);
    renderer.dispose();
    renderer = null;
  }
  scene = camera = controls = null;
  compGroup = wireGroup = boardGroup = labelGroup = flowPoints = null;
  flowData = [];
  compMeshes = [];
  if (container) container.innerHTML = '';
  container = null;
}

export function is3DActive() { return active; }
