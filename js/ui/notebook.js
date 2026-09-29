// NexLab — Lab Notebook: auto-generated experiment records

import { getState, addNotebookEntry, updateNotebookEntry } from '../state.js';
import { formatValue } from '../engine/components.js';

export function renderNotebook() {
  const container = document.getElementById('view-container');
  if (!container) return;

  const state = getState();
  const entries = state.notebook;

  container.innerHTML = `
    <div class="flex flex-between flex-center mb-16">
      <div>
        <h1>Lab Notebook</h1>
        <p>Auto-generated records of your experiments and discoveries.</p>
      </div>
      <button class="btn" onclick="window.nexlabExportNotebook()">Export Markdown</button>
    </div>

    ${entries.length === 0 ? `
      <div class="card">
        <p class="text-muted">No experiments recorded yet. Start an experiment in the Simulator to create your first notebook entry.</p>
        <a href="#/simulator" class="btn btn-primary">Open Simulator →</a>
      </div>
    ` : entries.map(entry => `
      <div class="notebook-entry">
        <div class="notebook-entry-header">
          <div>
            <div class="notebook-entry-title">${entry.title}</div>
            <div class="notebook-entry-meta">${new Date(entry.timestamp).toLocaleString()} · ${entry.topic}</div>
          </div>
          <span class="text-muted" style="font-size:11px">#${entry.id.slice(-4)}</span>
        </div>

        <div class="grid-2">
          <div>
            <div class="notebook-field"><label>Objective</label><div style="font-size:13px">${entry.objective}</div></div>
            <div class="notebook-field"><label>Components</label><div class="mono" style="font-size:12px">${entry.components}</div></div>
            ${entry.prediction ? `<div class="notebook-field"><label>Prediction</label><div class="mono text-accent" style="font-size:13px">${entry.prediction}</div></div>` : ''}
          </div>
          <div>
            ${entry.measured ? `<div class="notebook-field"><label>Measured</label><div class="mono text-success" style="font-size:13px">${entry.measured}</div></div>` : ''}
            ${entry.error ? `<div class="notebook-field"><label>Error</label><div class="mono text-warning" style="font-size:13px">${entry.error}</div></div>` : ''}
            ${entry.observations ? `<div class="notebook-field"><label>Observations</label><div style="font-size:12px">${entry.observations}</div></div>` : ''}
          </div>
        </div>

        <div class="notebook-field mt-8">
          <label>Conclusion</label>
          <textarea style="width:100%;min-height:60px" onchange="window.nexlabUpdateNotebook('${entry.id}', 'conclusion', this.value)">${entry.conclusion || ''}</textarea>
        </div>
      </div>
    `).join('')}
  `;
}

export function createNotebookEntry(data) {
  addNotebookEntry(data);
}

export function exportNotebook() {
  const state = getState();
  let md = '# NexLab — Lab Notebook\n\n';
  md += `**Engineer:** ${state.user.name}\n`;
  md += `**Domain:** ${state.user.domain}\n`;
  md += `**Exported:** ${new Date().toLocaleString()}\n\n---\n\n`;

  for (const entry of state.notebook) {
    md += `## ${entry.title}\n\n`;
    md += `**Date:** ${new Date(entry.timestamp).toLocaleString()}\n`;
    md += `**Topic:** ${entry.topic}\n\n`;
    md += `**Objective:** ${entry.objective}\n\n`;
    md += `**Components:** ${entry.components}\n\n`;
    if (entry.prediction) md += `**Prediction:** ${entry.prediction}\n\n`;
    if (entry.measured) md += `**Measured:** ${entry.measured}\n\n`;
    if (entry.error) md += `**Error:** ${entry.error}\n\n`;
    if (entry.observations) md += `**Observations:** ${entry.observations}\n\n`;
    if (entry.conclusion) md += `**Conclusion:** ${entry.conclusion}\n\n`;
    md += '---\n\n';
  }

  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'nexlab-notebook.md';
  a.click();
  URL.revokeObjectURL(url);
}
