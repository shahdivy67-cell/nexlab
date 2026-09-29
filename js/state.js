// NexLab — Application state and persistence (localStorage)

const STORAGE_KEY = 'nexlab_state_v1';

const DEFAULT_STATE = {
  user: { name: 'Engineer', domain: 'electronics', onboarded: false },
  skills: {
    'voltage': { level: 0, maxLevel: 100, intuition: [] },
    'current': { level: 0, maxLevel: 100, intuition: [] },
    'resistance': { level: 0, maxLevel: 100, intuition: [] },
    'power': { level: 0, maxLevel: 100, intuition: [] },
    'ohms-law': { level: 0, maxLevel: 100, intuition: [] },
    'series': { level: 0, maxLevel: 100, intuition: [] },
    'parallel': { level: 0, maxLevel: 100, intuition: [] },
    'kirchhoff': { level: 0, maxLevel: 100, intuition: [] },
    'capacitors': { level: 0, maxLevel: 100, intuition: [] },
    'rc-circuits': { level: 0, maxLevel: 100, intuition: [] },
  },
  experiments: {},  // experimentId -> { completed, steps, predictions }
  missions: {},     // missionId -> { completed, score, attempts }
  notebook: [],     // notebook entries
  discoveries: [],  // recent discoveries log
  projects: [],     // saved projects
  predictions: [],  // all predictions for intuition tracking
  lastExperiment: null,
  simState: {
    components: [],
    wires: [],
    running: false,
    time: 0,
    speed: 1,
    mode: 'dc', // 'dc' or 'transient'
  },
  mentorContext: {
    currentExperiment: null,
    hintLevel: 0,
    conversation: [],
  },
};

let state = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_STATE, ...parsed, skills: { ...DEFAULT_STATE.skills, ...parsed.skills } };
    }
  } catch (e) { /* corrupted state */ }
  return structuredClone(DEFAULT_STATE);
}

export function getState() { return state; }

export function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* quota */ }
}

export function updateState(updater) {
  updater(state);
  saveState();
}

export function resetState() {
  state = structuredClone(DEFAULT_STATE);
  saveState();
}

// ── Skill helpers ──
export function getSkillLevel(skillId) {
  return state.skills[skillId]?.level ?? 0;
}

export function addSkillXP(skillId, xp) {
  if (!state.skills[skillId]) return;
  const skill = state.skills[skillId];
  skill.level = Math.min(skill.maxLevel, skill.level + xp);
  saveState();
}

export function recordPrediction(skillId, predicted, actual) {
  if (!state.skills[skillId]) return;
  const error = Math.abs(predicted - actual);
  const pctError = actual !== 0 ? (error / Math.abs(actual)) * 100 : (error > 0 ? 100 : 0);
  state.skills[skillId].intuition.push({ predicted, actual, pctError, timestamp: Date.now() });
  state.predictions.push({ skillId, predicted, actual, pctError, timestamp: Date.now() });
  saveState();
}

export function getIntuitionAccuracy(skillId) {
  const history = state.skills[skillId]?.intuition ?? [];
  if (history.length === 0) return null;
  const recent = history.slice(-10);
  const avgError = recent.reduce((s, p) => s + p.pctError, 0) / recent.length;
  return Math.max(0, 100 - avgError);
}

// ── Discovery log ──
export function addDiscovery(text) {
  state.discoveries.unshift({ text, timestamp: Date.now() });
  if (state.discoveries.length > 50) state.discoveries.length = 50;
  saveState();
}

// ── Notebook ──
export function addNotebookEntry(entry) {
  state.notebook.unshift({
    id: `exp_${Date.now()}`,
    timestamp: Date.now(),
    ...entry,
  });
  saveState();
}

export function updateNotebookEntry(id, updates) {
  const entry = state.notebook.find(e => e.id === id);
  if (entry) { Object.assign(entry, updates); saveState(); }
}

// ── Projects ──
export function saveProject(project) {
  const existing = state.projects.findIndex(p => p.id === project.id);
  if (existing >= 0) state.projects[existing] = project;
  else state.projects.push(project);
  saveState();
}

export function getProject(id) {
  return state.projects.find(p => p.id === id);
}
