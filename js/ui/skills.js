// NexLab — Skill Graph: prerequisite-based learning visualization

import { getState, getSkillLevel, getIntuitionAccuracy } from '../state.js';
import { CONCEPTS } from '../data/concepts.js';

export function renderSkills() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const state = getState();

  // Build skill nodes with positions
  const skillNodes = [
    { id: 'voltage', x: 100, y: 50, label: 'Voltage' },
    { id: 'current', x: 100, y: 150, label: 'Current' },
    { id: 'resistance', x: 100, y: 250, label: 'Resistance' },
    { id: 'power', x: 100, y: 350, label: 'Power' },
    { id: 'ohms-law', x: 300, y: 150, label: "Ohm's Law" },
    { id: 'series', x: 300, y: 300, label: 'Series' },
    { id: 'parallel', x: 300, y: 400, label: 'Parallel' },
    { id: 'kirchhoff', x: 500, y: 350, label: 'Kirchhoff' },
    { id: 'capacitors', x: 100, y: 500, label: 'Capacitors' },
    { id: 'rc-circuits', x: 300, y: 550, label: 'RC Circuits' },
  ];

  // Edges (prerequisites)
  const edges = [
    ['voltage', 'ohms-law'], ['current', 'ohms-law'], ['resistance', 'ohms-law'],
    ['voltage', 'power'], ['current', 'power'],
    ['ohms-law', 'series'], ['ohms-law', 'parallel'],
    ['series', 'kirchhoff'], ['parallel', 'kirchhoff'],
    ['voltage', 'capacitors'], ['current', 'capacitors'],
    ['capacitors', 'rc-circuits'], ['ohms-law', 'rc-circuits'],
  ];

  container.innerHTML = `
    <h1>Skill Graph</h1>
    <p>Your engineering knowledge map. Skills unlock as you master prerequisites.</p>

    <div class="skill-graph" style="position:relative;min-height:650px">
      <svg style="position:absolute;inset:0;width:100%;height:100%">
        ${edges.map(([from, to]) => {
          const fromNode = skillNodes.find(n => n.id === from);
          const toNode = skillNodes.find(n => n.id === to);
          if (!fromNode || !toNode) return '';
          const fromLevel = getSkillLevel(from);
          const toLevel = getSkillLevel(to);
          const color = fromLevel >= 80 && toLevel >= 80 ? '#22c55e' : fromLevel >= 80 ? '#00d4ff' : '#1e2a42';
          return `<line x1="${fromNode.x + 70}" y1="${fromNode.y + 20}" x2="${toNode.x + 70}" y2="${toNode.y + 20}" stroke="${color}" stroke-width="2" ${fromLevel >= 80 ? '' : 'stroke-dasharray="4,4"'}/>`;
        }).join('')}
      </svg>

      ${skillNodes.map(node => {
        const level = getSkillLevel(node.id);
        const intuition = getIntuitionAccuracy(node.id);
        const status = level >= 80 ? 'completed' : level > 0 ? 'active' : 'locked';
        return `
          <div class="skill-node ${status}" style="left:${node.x}px;top:${node.y}px" onclick="window.location.hash='#/concept/${node.id}'">
            <div>${node.label}</div>
            <div class="skill-node-pct">${level}%</div>
            ${intuition !== null ? `<div style="font-size:9px;color:var(--text-muted)">Intuition: ${intuition.toFixed(0)}%</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <div class="grid-2 mt-16">
      <div class="card">
        <h3>Engineering Intuition</h3>
        <p style="font-size:12px">Prediction accuracy by topic — a measure of your engineering intuition.</p>
        ${Object.entries(state.skills).map(([id, s]) => {
          const intuition = getIntuitionAccuracy(id);
          if (intuition === null) return '';
          return `
            <div class="mb-8">
              <div class="flex flex-between">
                <span style="font-size:12px">${id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}</span>
                <span class="mono text-accent" style="font-size:11px">${intuition.toFixed(0)}%</span>
              </div>
              <div class="skill-bar"><div class="skill-bar-fill" style="width:${intuition}%"></div></div>
            </div>
          `;
        }).join('') || '<p class="text-muted" style="font-size:12px">No predictions yet. Start experimenting!</p>'}
      </div>

      <div class="card">
        <h3>Learning Path</h3>
        <p style="font-size:12px">Recommended next steps based on your skill graph.</p>
        ${getRecommendedPath(state)}
      </div>
    </div>
  `;
}

function getRecommendedPath(state) {
  const skills = state.skills;
  const recommendations = [];

  // Find skills with low level but prerequisites met
  for (const [id, s] of Object.entries(skills)) {
    if (s.level < 30) {
      const concept = CONCEPTS.find(c => c.id === id);
      if (concept) {
        const prereqsMet = concept.prerequisites.every(p => (skills[p]?.level ?? 0) >= 50);
        if (prereqsMet) {
          recommendations.push({ id, name: concept.title, reason: 'Prerequisites met' });
        }
      }
    }
  }

  if (recommendations.length === 0) {
    return '<p class="text-muted" style="font-size:12px">Complete more experiments to unlock recommendations.</p>';
  }

  return recommendations.slice(0, 4).map(r => `
    <div class="flex flex-between mb-8">
      <span style="font-size:12px">${r.name}</span>
      <span class="text-muted" style="font-size:10px">${r.reason}</span>
    </div>
  `).join('');
}
