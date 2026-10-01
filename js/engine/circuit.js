// NexLab — Circuit model: turns placed components + wires into a netlist.
// Connectivity is computed geometrically (union-find over terminals and
// wire segments). Ground symbols always belong to the global reference net.

export const SNAP = 20; // grid size in canvas pixels
const CONNECT_EPS = 10;  // px distance considered "electrically connected"

// ---------------------------------------------------------------------------
// Union-Find
// ---------------------------------------------------------------------------
class UnionFind {
  constructor() { this.parent = new Map(); }
  find(x) {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root);
    // path compression
    while (this.parent.get(x) !== root) {
      const next = this.parent.get(x);
      this.parent.set(x, root);
      x = next;
    }
    return root;
  }
  union(a, b) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// ---------------------------------------------------------------------------
// Component instance shape
// ---------------------------------------------------------------------------
// A component instance: { id, type, x, y, rotation (0|1|2|3), params:{}, state:{} }
// Terminal positions are computed from type + rotation.

const FOOTPRINTS = {
  dc_source: { leads: [[-40, 0], [40, 0]], body: 'circle' },
  resistor:  { leads: [[-40, 0], [40, 0]], body: 'rect' },
  capacitor: { leads: [[-40, 0], [40, 0]], body: 'plates' },
  led:       { leads: [[-40, 0], [40, 0]], body: 'diode' },
  diode:     { leads: [[-40, 0], [40, 0]], body: 'diode' },
  switch:    { leads: [[-40, 0], [40, 0]], body: 'switch' },
  ground:    { leads: [[0, 0]], body: 'ground' },
  wire:      { leads: [], body: 'wire' },
};

export function getLeads(component) {
  const fp = FOOTPRINTS[component.type];
  if (!fp) return [];
  const rot = component.rotation || 0;
  return fp.leads.map(([lx, ly]) => {
    // rotate lead offset by rotation * 90 degrees
    let x = lx, y = ly;
    for (let i = 0; i < rot; i++) {
      const tx = -y, ty = x;
      x = tx; y = ty;
    }
    return { x: component.x + x, y: component.y + y };
  });
}

// ---------------------------------------------------------------------------
// Netlist builder
// ---------------------------------------------------------------------------
// Input:  { components: [...], wires: [{ id, points: [{x,y}, ...] }] }
// Output: { nets: Map<netId, Set<compId:terminalIdx>>, nodeOfNet: Map, groundNet,
//           errors: [...], warnings: [...] }
//   netId 0 is always the ground reference.
// ---------------------------------------------------------------------------
export function buildNetlist(components, wires) {
  const uf = new UnionFind();
  const errors = [];
  const warnings = [];

  // Key helpers
  const termKey = (compId, termIdx) => `t:${compId}:${termIdx}`;
  const wireKey = (wireId, segIdx) => `w:${wireId}:${segIdx}`;

  // 1. Register all component terminals
  const compTerminals = new Map(); // compId -> [{x,y}]
  for (const comp of components) {
    if (comp.type === 'wire') continue;
    const leads = getLeads(comp);
    compTerminals.set(comp.id, leads);
    leads.forEach((_, i) => uf.find(termKey(comp.id, i)));
  }

  // 2. Register wire segments
  const wireSegments = []; // { wireId, segIdx, x1,y1,x2,y2 }
  for (const wire of wires) {
    const pts = wire.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const segIdx = wireSegments.length;
      wireSegments.push({ wireId: wire.id, segIdx, x1: pts[i].x, y1: pts[i].y, x2: pts[i + 1].x, y2: pts[i + 1].y });
      uf.find(wireKey(wire.id, segIdx));
    }
  }

  // 3. Union terminals with nearby wire segments
  for (const [compId, leads] of compTerminals) {
    for (let ti = 0; ti < leads.length; ti++) {
      const t = leads[ti];
      for (const seg of wireSegments) {
        if (distPointToSegment(t.x, t.y, seg.x1, seg.y1, seg.x2, seg.y2) < CONNECT_EPS) {
          uf.union(termKey(compId, ti), wireKey(seg.wireId, seg.segIdx));
        }
      }
    }
  }

  // 4. Union wire segments that touch (T-junctions, L-bends, shared endpoints)
  for (let i = 0; i < wireSegments.length; i++) {
    for (let j = i + 1; j < wireSegments.length; j++) {
      const a = wireSegments[i], b = wireSegments[j];
      // Same wire: consecutive segments share endpoints — union them
      if (a.wireId === b.wireId) {
        uf.union(wireKey(a.wireId, a.segIdx), wireKey(b.wireId, b.segIdx));
        continue;
      }
      // Different wires: connect if an endpoint of one lies on the other
      const aEnds = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }];
      const bEnds = [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];
      let connected = false;
      for (const ae of aEnds) {
        if (distPointToSegment(ae.x, ae.y, b.x1, b.y1, b.x2, b.y2) < CONNECT_EPS) connected = true;
      }
      for (const be of bEnds) {
        if (distPointToSegment(be.x, be.y, a.x1, a.y1, a.x2, a.y2) < CONNECT_EPS) connected = true;
      }
      if (connected) uf.union(wireKey(a.wireId, a.segIdx), wireKey(b.wireId, b.segIdx));
    }
  }

  // 5. Union terminals that are very close to each other (component leads touching)
  const allTerms = [];
  for (const [compId, leads] of compTerminals) {
    for (let ti = 0; ti < leads.length; ti++) {
      allTerms.push({ compId, ti, x: leads[ti].x, y: leads[ti].y });
    }
  }
  for (let i = 0; i < allTerms.length; i++) {
    for (let j = i + 1; j < allTerms.length; j++) {
      const a = allTerms[i], b = allTerms[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < CONNECT_EPS) {
        uf.union(termKey(a.compId, a.ti), termKey(b.compId, b.ti));
      }
    }
  }

  // 6. Ground: all ground terminals join global net 0
  const GROUND_NET = 0;
  for (const [compId, leads] of compTerminals) {
    const comp = components.find(c => c.id === compId);
    if (comp && comp.type === 'ground') {
      uf.union(termKey(compId, 0), 'ground');
    }
  }
  uf.find('ground');

  // 7. Collect nets
  const netMap = new Map(); // rootKey -> netId
  const nets = new Map();   // netId -> [{ compId, termIdx }]
  let nextNetId = 1;

  const ensureNet = (rootKey) => {
    if (!netMap.has(rootKey)) {
      netMap.set(rootKey, nextNetId++);
    }
    return netMap.get(rootKey);
  };

  // Ground net
  netMap.set(uf.find('ground'), GROUND_NET);
  nets.set(GROUND_NET, []);

  for (const [compId, leads] of compTerminals) {
    for (let ti = 0; ti < leads.length; ti++) {
      const root = uf.find(termKey(compId, ti));
      let netId;
      if (root === uf.find('ground')) {
        netId = GROUND_NET;
      } else {
        netId = ensureNet(root);
      }
      if (!nets.has(netId)) nets.set(netId, []);
      nets.get(netId).push({ compId, termIdx: ti });
    }
  }

  // 8. Validate
  const groundComps = components.filter(c => c.type === 'ground');
  if (groundComps.length === 0) {
    errors.push('No ground reference. Place a Ground component to define 0 V.');
  }

  // Check for floating nets (nets with only one terminal and no source)
  for (const [netId, terms] of nets) {
    if (netId === GROUND_NET) continue;
    if (terms.length === 1) {
      const comp = components.find(c => c.id === terms[0].compId);
      if (comp && comp.type !== 'ground') {
        warnings.push(`Net ${netId} has only one connection (floating).`);
      }
    }
  }

  // Check for shorted voltage sources
  const sources = components.filter(c => c.type === 'dc_source');
  for (const src of sources) {
    const leads = compTerminals.get(src.id);
    if (leads && leads.length === 2) {
      const netA = findNetOfTerminal(nets, src.id, 0, uf, components);
      const netB = findNetOfTerminal(nets, src.id, 1, uf, components);
      if (netA !== undefined && netA === netB) {
        errors.push(`DC source "${src.id}" is shorted (both terminals on same net).`);
      }
    }
  }

  return { nets, groundNet: GROUND_NET, errors, warnings, uf, compTerminals };
}

function findNetOfTerminal(nets, compId, termIdx, uf, components) {
  for (const [netId, terms] of nets) {
    for (const t of terms) {
      if (t.compId === compId && t.termIdx === termIdx) return netId;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Serialize / deserialize circuits (for save/load, projects, branching)
// ---------------------------------------------------------------------------
export function serializeCircuit(components, wires) {
  return JSON.stringify({
    version: 1,
    components: components.map(c => ({
      id: c.id, type: c.type, x: c.x, y: c.y,
      rotation: c.rotation || 0, params: c.params || {},
    })),
    wires: wires.map(w => ({ id: w.id, points: w.points })),
  });
}

export function deserializeCircuit(json) {
  const data = JSON.parse(json);
  return { components: data.components, wires: data.wires };
}
