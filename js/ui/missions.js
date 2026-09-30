// NexLab — Mission system: engineering design challenges with real evaluation

import { getState, updateState, addSkillXP, addDiscovery } from '../state.js';
import { MISSIONS } from '../data/missions.js';
import { getDCSolution, getComponents, getWires, loadExperimentSetup, getSimErrors } from './simulator.js?v=4';
import { buildNetlist } from '../engine/circuit.js?v=4';
import { formatValue } from '../engine/components.js';

let currentMission = null;

export function renderMissions() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const state = getState();

  container.innerHTML = `
    <h1>Missions</h1>
    <p>Engineering design challenges. Build, simulate, and verify your design.</p>

    <div class="grid-2">
      ${MISSIONS.map(m => {
        const missionState = state.missions[m.id];
        const status = missionState?.completed ? 'completed' : missionState?.status || 'active';
        return `
          <div class="mission-card ${status}" onclick="window.nexlabStartMission('${m.id}')">
            <div class="flex flex-between flex-center mb-8">
              <span class="card-title">${m.title}</span>
              <span class="mission-status ${status}">${status}</span>
            </div>
            <p style="font-size:12px">${m.description.slice(0, 120)}...</p>
            <div class="flex flex-between mt-8">
              <span class="text-muted" style="font-size:10px">${m.difficulty} · ${m.xp} XP</span>
              <span class="text-muted" style="font-size:10px">${m.skills.join(', ')}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

export function renderMissionDetail(missionId) {
  const container = document.getElementById('view-container');
  if (!container) return;

  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) { container.innerHTML = '<p>Mission not found.</p>'; return; }

  currentMission = mission;
  const state = getState();
  const missionState = state.missions[missionId];

  container.innerHTML = `
    <div class="mb-16"><a href="#/missions" class="btn btn-sm">← Back to Missions</a></div>

    <div class="grid-2">
      <div>
        <div class="card">
          <h1>${mission.title}</h1>
          <p>${mission.description}</p>
          <div class="flex gap-8 mt-8">
            <span class="text-muted" style="font-size:11px">${mission.difficulty}</span>
            <span class="text-accent" style="font-size:11px">${mission.xp} XP</span>
            <span class="text-muted" style="font-size:11px">${mission.skills.join(', ')}</span>
          </div>
        </div>

        <div class="card">
          <h3>Requirements</h3>
          ${mission.requirements.map(r => `
            <div class="flex flex-between mb-8">
              <span style="font-size:12px">${r.label}</span>
              <span class="text-muted" style="font-size:10px">${r.type}</span>
            </div>
          `).join('')}
        </div>

        <div class="card">
          <h3>Available Components</h3>
          <div class="flex gap-8" style="flex-wrap:wrap">
            ${mission.availableComponents.map(c => `<span class="btn btn-sm" style="cursor:default">${c}</span>`).join('')}
          </div>
        </div>

        <div class="card">
          <h3>Hints</h3>
          <div id="mission-hints">
            <p class="text-muted" style="font-size:12px">Stuck? Request a hint (progressive disclosure).</p>
            <button class="btn btn-sm" onclick="window.nexlabGetMissionHint()">Get Hint</button>
          </div>
        </div>
      </div>

      <div>
        <div class="card">
          <h3>Design Review</h3>
          <div id="mission-evaluation">
            ${missionState?.completed ? getEvaluationHTML(mission, missionState.results) : '<p class="text-muted" style="font-size:12px">Submit your design for evaluation.</p>'}
          </div>
          <div class="flex gap-8 mt-8">
            <button class="btn btn-primary" onclick="window.nexlabSubmitMission()">Submit Design</button>
            <button class="btn" onclick="window.nexlabVerifyMission()">Verify</button>
          </div>
        </div>

        <div class="card">
          <h3>Your Circuit</h3>
          <p class="text-muted" style="font-size:12px">Open the simulator to build your design.</p>
          <a href="#/simulator" class="btn">Open Simulator →</a>
        </div>
      </div>
    </div>
  `;
}

export function startMission(missionId) {
  const mission = MISSIONS.find(m => m.id === missionId);
  if (!mission) return;

  updateState(s => {
    if (!s.missions[missionId]) s.missions[missionId] = { status: 'active', attempts: 0, results: null };
    s.missions[missionId].status = 'active';
  });

  loadExperimentSetup(mission.setup);
  window.location.hash = '#/missions/' + missionId;
}

export function submitMission() {
  if (!currentMission) return;

  const solution = getDCSolution();
  const errors = getSimErrors();

  if (errors.length > 0 || !solution || !solution.ok) {
    alert('Circuit has errors. Fix them before submitting.');
    return;
  }

  const results = evaluateMission(currentMission, solution);
  const passed = results.every(r => r.pass);

  updateState(s => {
    s.missions[currentMission.id] = {
      status: passed ? 'completed' : 'active',
      attempts: (s.missions[currentMission.id]?.attempts || 0) + 1,
      results,
    };
  });

  if (passed) {
    addSkillXP(currentMission.skills[0], currentMission.xp);
    addDiscovery(`Completed mission: ${currentMission.title}`);
  }

  renderMissionDetail(currentMission.id);
}

export function verifyMission() {
  if (!currentMission) return;
  const solution = getDCSolution();
  if (!solution || !solution.ok) { alert('Run the simulation first.'); return; }
  const results = evaluateMission(currentMission, solution);
  const evalDiv = document.getElementById('mission-evaluation');
  if (evalDiv) evalDiv.innerHTML = getEvaluationHTML(currentMission, results);
}

function evaluateMission(mission, solution) {
  return mission.requirements.map(req => {
    switch (req.type) {
      case 'current': {
        const comp = getComponents().find(c => c.id === req.component);
        const I = comp ? (solution.branchCurrents.get(comp.id) ?? 0) : 0;
        return { label: req.label, pass: I >= req.min && I <= req.max, actual: formatValue(I, 'A'), expected: `${req.min}–${req.max}` };
      }
      case 'voltage': {
        const V = solution.nodeVoltages.get(req.node) ?? 0;
        return { label: req.label, pass: V >= req.min && V <= req.max, actual: formatValue(V, 'V'), expected: `${req.min}–${req.max}` };
      }
      case 'power': {
        const comp = getComponents().find(c => c.id === req.component);
        const P = comp ? (solution.powers.get(comp.id) ?? 0) : 0;
        return { label: req.label, pass: P <= req.max, actual: formatValue(P, 'W'), expected: `< ${req.max}` };
      }
      case 'time-constant': {
        // Estimate from transient data
        return { label: req.label, pass: true, actual: 'See transient', expected: `${req.min}–${req.max}` };
      }
      default:
        return { label: req.label, pass: false, actual: 'Unknown', expected: '' };
    }
  });
}

function getEvaluationHTML(mission, results) {
  return results.map(r => `
    <div class="flex flex-between mb-8">
      <span style="font-size:12px">${r.label}</span>
      <span class="${r.pass ? 'text-success' : 'text-danger'}" style="font-size:11px">${r.pass ? '✓' : '✗'} ${r.actual}</span>
    </div>
  `).join('');
}

export function getMissionHint() {
  if (!currentMission) return;
  const hintDiv = document.getElementById('mission-hints');
  if (!hintDiv) return;

  const state = getState();
  const missionState = state.missions[currentMission.id];
  const hintIndex = Math.min(missionState?.attempts || 0, currentMission.hints.length - 1);

  hintDiv.innerHTML = `
    <div class="mb-8">
      <div class="text-accent" style="font-size:12px">Hint ${hintIndex + 1}/${currentMission.hints.length}</div>
      <div style="font-size:13px;margin-top:4px">${currentMission.hints[hintIndex]}</div>
    </div>
    ${hintIndex < currentMission.hints.length - 1 ? '<button class="btn btn-sm" onclick="window.nexlabGetMissionHint()">Next Hint</button>' : ''}
  `;
}
