// NexLab — Learn section: concept pages with interactive content

import { CONCEPTS, CATEGORIES } from '../data/concepts.js';
import { getState, getSkillLevel } from '../state.js';

export function renderLearn() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const state = getState();
  const concepts = CONCEPTS.map(c => ({
    ...c,
    skillLevel: getSkillLevel(c.id),
  }));

  container.innerHTML = `
    <h1>Learn</h1>
    <p>Master engineering concepts through interactive experiments.</p>

    <div class="tabs">
      <div class="tab active" data-category="all">All</div>
      ${CATEGORIES.map(c => `<div class="tab" data-category="${c.id}">${c.name}</div>`).join('')}
    </div>

    <div class="grid-3">
      ${concepts.map(c => `
        <div class="card concept-card" data-category="${c.category.toLowerCase()}" style="cursor:pointer" onclick="window.nexlabOpenConcept('${c.id}')">
          <div class="flex flex-between flex-center mb-8">
            <span class="card-title">${c.title}</span>
            <span class="text-muted" style="font-size:10px">${c.difficulty}</span>
          </div>
          <p style="font-size:12px">${c.summary}</p>
          <div class="mono text-accent" style="font-size:14px;margin:8px 0">${c.formula}</div>
          <div class="skill-bar"><div class="skill-bar-fill" style="width:${c.skillLevel}%"></div></div>
          <div class="text-muted" style="font-size:10px;margin-top:4px">${c.skillLevel}% mastered</div>
        </div>
      `).join('')}
    </div>
  `;

  // Tab filtering
  container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.category;
      container.querySelectorAll('.concept-card').forEach(card => {
        card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
      });
    });
  });
}

export function renderConceptDetail(conceptId) {
  const container = document.getElementById('view-container');
  if (!container) return;

  const concept = CONCEPTS.find(c => c.id === conceptId);
  if (!concept) { container.innerHTML = '<p>Concept not found.</p>'; return; }

  const state = getState();
  const skillLevel = getSkillLevel(conceptId);

  container.innerHTML = `
    <div class="mb-16"><a href="#/learn" class="btn btn-sm">← Back to Learn</a></div>
    <div class="grid-2">
      <div>
        <div class="card">
          <h1>${concept.title}</h1>
          <p>${concept.summary}</p>
          <div class="mono text-accent" style="font-size:24px;margin:16px 0">${concept.formula}</div>
          <p class="text-muted" style="font-size:12px">${concept.formulaLabel}</p>
          <div class="mt-16">${concept.explanation.split('\n\n').map(p => `<p>${p}</p>`).join('')}</div>
        </div>

        <div class="card">
          <h3>Key Points</h3>
          <ul style="padding-left:20px;color:var(--text-secondary);font-size:13px">
            ${concept.keyPoints.map(kp => `<li class="mb-8">${kp}</li>`).join('')}
          </ul>
        </div>
      </div>

      <div>
        <div class="card">
          <h3>Mastery</h3>
          <div class="skill-bar" style="height:8px"><div class="skill-bar-fill" style="width:${skillLevel}%"></div></div>
          <div class="text-muted" style="font-size:11px;margin-top:4px">${skillLevel}% complete</div>
        </div>

        <div class="card">
          <h3>Prerequisites</h3>
          ${concept.prerequisites.length > 0 ? concept.prerequisites.map(p => {
            const prereq = CONCEPTS.find(c => c.id === p);
            return `<div class="flex flex-between mb-8"><span style="font-size:12px">${prereq?.title ?? p}</span><span class="text-muted" style="font-size:10px">${getSkillLevel(p)}%</span></div>`;
          }).join('') : '<p class="text-muted" style="font-size:12px">No prerequisites — start here!</p>'}
        </div>

        <div class="card">
          <h3>Experiment</h3>
          <p style="font-size:12px">Apply this concept in a hands-on experiment.</p>
          <a href="#/simulator" class="btn btn-primary">Open Simulator →</a>
        </div>
      </div>
    </div>
  `;
}
