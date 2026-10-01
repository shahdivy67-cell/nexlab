// NexLab — Main application: router, initialization, global event handlers

import { getState, saveState, updateState, resetState, addNotebookEntry, addDiscovery } from './state.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderLearn, renderConceptDetail } from './ui/learn.js';
import { initSimulator, runSimulation, toggleSimulation, resetSimulation, stepSimulation, setSimSpeed, setSimMode, setTool, setPlacingType, setViewMode, buildFromDescription, addComponent, clearCircuit, destroyCircuit, loadExperimentSetup, injectFault, clearFault, setComponentValue, clearProbes, exportCircuit, importCircuit, startScopeRecording, stopScopeRecording, resetScope, setScopeVdiv, setScopeTdiv, setScopeChannel, setScopeEnabled, getComponents, getWires, getDCSolution, getProbes, getSimErrors, getFaultState, getScopeData, getScopeChannels, getScopeEnabled, getScopeColors, getScopeVdiv, getScopeTdiv, getScopeTimePoints, getScopeNodeHistory, getSimTime, getSimRunning, getSimMode, getSimSpeed, getSimTmax, getSimDt, getScopeTime, getScopeMaxTime, getScopeDt, getScopeRecording } from './ui/simulator.js?v=8';
import { initInstruments, setMultimeterMode, updateMultimeter, drawScope, toggleScope, resetScope as resetScopeUI, getScopeStats } from './ui/instruments.js';
import { initMentor, renderMentor, askMentor, getMentorMessages } from './ui/mentor.js';
import { renderNotebook, createNotebookEntry, exportNotebook } from './ui/notebook.js';
import { renderMissions, renderMissionDetail, startMission, submitMission, verifyMission, getMissionHint } from './ui/missions.js';
import { renderSkills } from './ui/skills.js';
import { EXPERIMENTS } from './data/experiments.js';
import { MISSIONS } from './data/missions.js';
import { COMPONENT_DEFS, parseValue, formatValue } from './engine/components.js';
import { buildNetlist, getLeads, serializeCircuit, deserializeCircuit } from './engine/circuit.js?v=5';
import { solveDC, solveTransient, equivalentResistance } from './engine/solver.js';

// ── Router ──
const routes = {
  'dashboard': renderDashboard,
  'learn': renderLearn,
  'simulator': initSimulator,
  'missions': renderMissions,
  'projects': renderDashboard, // TODO: projects page
  'skills': renderSkills,
  'mentor': renderMentor,
  'notebook': renderNotebook,
  'progress': renderSkills, // TODO: progress page
};

function router() {
  const hash = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [route, param] = hash.split('/');
  const container = document.getElementById('view-container');
  if (!container) return;

  // Update nav active state
  document.querySelectorAll('.nav-list li a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });

  const render = routes[route] || renderDashboard;
  if (param && route === 'learn') {
    renderConceptDetail(param);
  } else if (param && route === 'missions') {
    renderMissionDetail(param);
  } else {
    render();
  }
}

// ── Global event handlers ──
window.nexlabToggleSim = toggleSimulation;
window.nexlabResetSim = resetSimulation;
window.nexlabStepSim = stepSimulation;
window.nexlabSetSpeed = setSimSpeed;
window.nexlabSetMode = setSimMode;
window.nexlabSetTool = setTool;
window.nexlabSetView = setViewMode;
window.nexlabBuildCircuit = buildFromDescription;
window.nexlabSetPlacingType = setPlacingType;
window.nexlabAddComponent = addComponent;
window.nexlabClearCircuit = clearCircuit;
window.nexlabLoadExperiment = loadExperimentSetup;
window.nexlabInjectFault = injectFault;
window.nexlabClearFault = clearFault;
window.nexlabUpdateParam = setComponentValue;
window.nexlabClearProbes = clearProbes;
window.nexlabExportCircuit = exportCircuit;
window.nexlabImportCircuit = importCircuit;
window.nexlabStartScope = startScopeRecording;
window.nexlabStopScope = stopScopeRecording;
window.nexlabResetScope = resetScope;
window.nexlabSetScopeVdiv = setScopeVdiv;
window.nexlabSetScopeTdiv = setScopeTdiv;
window.nexlabSetScopeChannel = setScopeChannel;
window.nexlabSetScopeEnabled = setScopeEnabled;
window.nexlabOpenConcept = (id) => { window.location.hash = `#/learn/${id}`; };
window.nexlabStartMission = startMission;
window.nexlabSubmitMission = submitMission;
window.nexlabVerifyMission = verifyMission;
window.nexlabGetMissionHint = getMissionHint;
window.nexlabAskMentor = askMentor;
window.nexlabUpdateNotebook = (id, field, value) => {
  const state = getState();
  const entry = state.notebook.find(e => e.id === id);
  if (entry) { entry[field] = value; saveState(); }
};
window.nexlabExportNotebook = exportNotebook;
window.nexlabDestroy = destroyCircuit;

// ── Initialization ──
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  router();
  // Auto-run simulation if circuit exists
  const state = getState();
  if (state.simState.components.length > 0) {
    setTimeout(() => runSimulation(), 100);
  }
});
