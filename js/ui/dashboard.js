// NexLab — Home dashboard: engineering command center

import { getState, getSkillLevel, getIntuitionAccuracy, addDiscovery } from '../state.js';
import { EXPERIMENTS } from '../data/experiments.js';
import { MISSIONS } from '../data/missions.js';
import { CONCEPTS } from '../data/concepts.js';

export function renderDashboard() {
  const state = getState();
  const container = document.getElementById('view-container');
  if (!container) return;

  const skills = Object.entries(state.skills).map(([id, s]) => ({
    id, name: id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
    level: s.level, intuition: getIntuitionAccuracy(id),
  }));

  const activeExp = state.lastExperiment ? EXPERIMENTS.find(e => e.id === state.lastExperiment) : null;
  const activeMission = Object.entries(state.missions).find(([_, m]) => m.status === 'active');
  const recentDiscoveries = state.discoveries.slice(0, 5);
  const completedExps = Object.keys(state.experiments).filter(id => state.experiments[id].completed);

  // Recommend experiment: lowest skill with unlocked prereqs
  const recommended = EXPERIMENTS.find(e => !completedExps.includes(e.id) && e.concept && getSkillLevel(e.concept) < 80);

  container.innerHTML = `
    <div class="dash-header">
      <h1>Welcome back, ${state.user.name}</h1>
      <p>What are we going to build and investigate today?</p>
    </div>

    <div class="dash-grid">
      <div>
        ${activeExp ? `
        <div class="dash-section">
          <div class="dash-section-title">Continue Learning</div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">${activeExp.title}</span>
              <span class="text-muted">${activeExp.difficulty}</span>
            </div>
            <p style="font-size:13px">${activeExp.objective}</p>
            <div class="skill-bar"><div class="skill-bar-fill" style="width:${(state.experiments[activeExp.id]?.progress ?? 0)}%"></div></div>
            <div class="mt-8"><a href="#/simulator" class="btn btn-primary">Continue →</a></div>
          </div>
        </div>` : ''}

        ${recommended ? `
        <div class="dash-section">
          <div class="dash-section-title">Recommended Experiment</div>
          <div class="card">
            <div class="card-header">
              <span class="card-title">${recommended.title}</span>
              <span class="text-muted">${recommended.duration}</span>
            </div>
            <p style="font-size:13px">${recommended.objective}</p>
            <a href="#/simulator" class="btn">Start Experiment →</a>
          </div>
        </div>` : ''}

        <div class="dash-section">
          <div class="dash-section-title">Current Missions</div>
          ${MISSIONS.filter(m => !state.missions[m.id]?.completed).slice(0, 2).map(m => `
            <div class="mission-card" onclick="window.location.hash='#/missions'">
              <div class="flex flex-between flex-center mb-8">
                <span class="card-title">${m.title}</span>
                <span class="mission-status active">${m.difficulty}</span>
              </div>
              <p style="font-size:12px">${m.description.slice(0, 100)}...</p>
            </div>
          `).join('') || '<p class="text-muted">No active missions. Check the Missions tab.</p>'}
        </div>

        <div class="dash-section">
          <div class="dash-section-title">Recent Discoveries</div>
          ${recentDiscoveries.map(d => `
            <div class="card" style="padding:12px;margin-bottom:8px">
              <div style="font-size:12px">${d.text}</div>
              <div class="text-muted" style="font-size:10px;margin-top:4px">${new Date(d.timestamp).toLocaleDateString()}</div>
            </div>
          `).join('') || '<p class="text-muted">No discoveries yet. Start experimenting!</p>'}
        </div>
      </div>

      <div>
        <div class="dash-section">
          <div class="dash-section-title">Skill Development</div>
          <div class="card">
            ${skills.map(s => `
              <div class="mb-16">
                <div class="flex flex-between">
                  <span style="font-size:12px">${s.name}</span>
                  <span class="mono text-accent" style="font-size:11px">${s.level}%</span>
                </div>
                <div class="skill-bar"><div class="skill-bar-fill" style="width:${s.level}%"></div></div>
                ${s.intuition !== null ? `<div class="text-muted" style="font-size:10px;margin-top:2px">Intuition: ${s.intuition.toFixed(0)}%</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <div class="dash-section">
          <div class="dash-section-title">Quick Actions</div>
          <div class="card">
            <div class="flex flex-between mb-8"><span style="font-size:12px">Simulator</span><a href="#/simulator" class="btn btn-sm">Open →</a></div>
            <div class="flex flex-between mb-8"><span style="font-size:12px">AI Mentor</span><a href="#/mentor" class="btn btn-sm">Ask →</a></div>
            <div class="flex flex-between mb-8"><span style="font-size:12px">Lab Notebook</span><a href="#/notebook" class="btn btn-sm">View →</a></div>
            <div class="flex flex-between"><span style="font-size:12px">Skill Graph</span><a href="#/skills" class="btn btn-sm">View →</a></div>
          </div>
        </div>

        <div class="dash-section">
          <div class="dash-section-title">Concepts</div>
          <div class="card">
            ${CONCEPTS.slice(0, 5).map(c => `
              <div class="flex flex-between mb-8">
                <span style="font-size:12px">${c.title}</span>
                <span class="text-muted" style="font-size:10px">${c.difficulty}</span>
              </div>
            `).join('')}
            <a href="#/learn" class="btn btn-sm">View All →</a>
          </div>
        </div>
      </div>
    </div>
  `;
}
