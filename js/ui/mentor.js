// NexLab — AI Engineering Mentor: context-aware rule-based tutor
// Reads simulation state, experiment progress, and skill graph to guide students.

import { getState, getSkillLevel, getIntuitionAccuracy, recordPrediction, addDiscovery } from '../state.js';
import { getDCSolution, getComponents, getWires, getProbes, getSimErrors, getFaultState, getCurrentExperiment, getHintLevel, setHintLevel } from './simulator.js?v=5';
import { buildNetlist } from '../engine/circuit.js?v=4';
import { formatValue } from '../engine/components.js';

let messages = [];

export function initMentor() {
  messages = [];
  addMessage('mentor', 'Hello! I\'m your AI Engineering Mentor. I can see your circuit, your simulation results, and your learning progress. Ask me anything about your experiment, or say "hint" for guidance.');
}

export function renderMentor() {
  const container = document.getElementById('view-container');
  if (!container) return;

  container.innerHTML = `
    <h1>AI Engineering Mentor</h1>
    <p>Context-aware guidance based on your circuit, simulation, and learning progress.</p>

    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        ${messages.map(m => `
          <div class="chat-message ${m.role}">
            <div class="chat-avatar">${m.role === 'mentor' ? '◭' : '◉'}</div>
            <div class="chat-bubble">${m.text}</div>
          </div>
        `).join('')}
      </div>
      <div class="chat-input">
        <input type="text" id="mentor-input" placeholder="Ask about your circuit, request a hint, or ask 'what if'..." onkeydown="if(event.key==='Enter')window.nexlabAskMentor()">
        <button class="btn btn-primary" onclick="window.nexlabAskMentor()">Send</button>
      </div>
    </div>

    <div class="grid-2 mt-16">
      <div class="card">
        <h3>Quick Actions</h3>
        <div class="flex gap-8 mb-8">
          <button class="btn btn-sm" onclick="window.nexlabAskMentor('hint')">Get Hint</button>
          <button class="btn btn-sm" onclick="window.nexlabAskMentor('check my circuit')">Check Circuit</button>
          <button class="btn btn-sm" onclick="window.nexlabAskMentor('what should I measure?')">What to Measure</button>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-sm" onclick="window.nexlabAskMentor('explain this result')">Explain Result</button>
          <button class="btn btn-sm" onclick="window.nexlabAskMentor('what if I double the resistance?')">What If?</button>
        </div>
      </div>
      <div class="card">
        <h3>Mentor Context</h3>
        <div id="mentor-context" style="font-size:12px;color:var(--text-secondary)">
          ${getContextSummary()}
        </div>
      </div>
    </div>
  `;

  // Scroll to bottom
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getContextSummary() {
  const state = getState();
  const solution = getDCSolution();
  const fault = getFaultState();
  const exp = getCurrentExperiment();

  let html = '<div class="notebook-field"><label>Current Experiment</label><div>' + (exp ? exp.title : 'None') + '</div></div>';
  html += '<div class="notebook-field"><label>Circuit</label><div>' + getComponents().length + ' components, ' + getWires().length + ' wires</div></div>';
  html += '<div class="notebook-field"><label>Simulation</label><div>' + (solution && solution.ok ? 'Solved' : 'Not solved') + '</div></div>';
  if (fault.active) html += '<div class="notebook-field"><label>Active Fault</label><div class="text-danger">' + fault.active + ' on ' + fault.component + '</div></div>';
  html += '<div class="notebook-field"><label>Hint Level</label><div>' + getHintLevel() + ' / 4</div></div>';
  return html;
}

export function askMentor(question) {
  const input = document.getElementById('mentor-input');
  const q = question || input?.value?.trim();
  if (!q) return;

  addMessage('user', q);
  if (input) input.value = '';

  const response = generateResponse(q);
  addMessage('mentor', response);

  renderMentor();
}

function addMessage(role, text) {
  messages.push({ role, text, timestamp: Date.now() });
}

function generateResponse(query) {
  const q = query.toLowerCase();
  const state = getState();
  const solution = getDCSolution();
  const fault = getFaultState();
  const exp = getCurrentExperiment();
  const hintLevel = getHintLevel();

  // Hint request
  if (q === 'hint' || q.includes('hint') || q.includes('help')) {
    return getProgressiveHint(exp, hintLevel);
  }

  // Circuit check
  if (q.includes('check') && q.includes('circuit')) {
    return checkCircuit(solution);
  }

  // What to measure
  if (q.includes('measure') || q.includes('what should')) {
    return suggestMeasurement(solution, fault);
  }

  // Explain result
  if (q.includes('explain') || q.includes('why')) {
    return explainResult(solution, fault);
  }

  // What if
  if (q.includes('what if')) {
    return handleWhatIf(q);
  }

  // Fault diagnosis
  if (fault.active && (q.includes('fault') || q.includes('wrong') || q.includes('problem') || q.includes('diagnose'))) {
    return diagnoseFault(fault, solution);
  }

  // Prediction comparison
  if (q.includes('predict') || q.includes('compare')) {
    return comparePrediction(solution);
  }

  // Default: context-aware response
  return getContextualResponse(q, state, solution, exp);
}

function getProgressiveHint(exp, level) {
  if (!exp) return 'Start an experiment first, then I can give you progressive hints.';
  const step = exp.steps[0]; // Simplified: use first step
  if (!step) return 'No hints available for this experiment.';

  const hints = [
    `Question: ${step.hint || 'What do you think will happen?'}`,
    `Direction: Try measuring the ${step.measurement || 'key quantity'} in your circuit.`,
    `Specific: Use the multimeter to measure across the relevant component.`,
    `Explanation: The answer relates to ${exp.concept}. Review the concept page if needed.`,
  ];

  const hint = hints[Math.min(level, hints.length - 1)];
  setHintLevel(Math.min(level + 1, 4));
  return hint;
}

function checkCircuit(solution) {
  if (!solution) return 'Run the simulation first, then I can check your circuit.';
  if (!solution.ok) return 'There\'s a problem with your circuit. Check for shorts, floating nodes, or missing ground.';

  const components = getComponents();
  const issues = [];

  // Check for common issues
  const hasGround = components.some(c => c.type === 'ground');
  if (!hasGround) issues.push('No ground reference found.');

  const hasSource = components.some(c => c.type === 'dc_source');
  if (!hasSource) issues.push('No voltage source found.');

  if (issues.length > 0) return 'Issues found:\n' + issues.map(i => '• ' + i).join('\n');

  return 'Your circuit looks good! All components are properly connected. Run the simulation to see the results.';
}

function suggestMeasurement(solution, fault) {
  if (fault.active) {
    return 'There\'s a fault in your circuit. Try measuring voltages at different points to isolate the problem. Start with the power supply and work your way through the circuit.';
  }
  if (!solution || !solution.ok) return 'Run the simulation first.';
  return 'Try measuring the voltage across key components. Compare your measurements with your predictions. Where do they differ?';
}

function explainResult(solution, fault) {
  if (fault.active) {
    return `The fault (${fault.active}) is affecting your circuit. In a real lab, you'd use measurements to find the anomaly. What do you observe that's unexpected?`;
  }
  if (!solution || !solution.ok) return 'No results to explain yet.';
  return 'Your simulation results come from solving the circuit equations. Compare them with your prediction — any difference is a learning opportunity.';
}

function handleWhatIf(query) {
  // Parse "what if I double the resistance" etc.
  const components = getComponents();
  const resistors = components.filter(c => c.type === 'resistor');
  const caps = components.filter(c => c.type === 'capacitor');

  if (query.includes('double') && query.includes('resistance') && resistors.length > 0) {
    const r = resistors[0];
    const currentR = parseFloat(r.params.resistance) || 100;
    const newR = currentR * 2;
    return `If you double the resistance from ${formatValue(currentR, 'Ω')} to ${formatValue(newR, 'Ω')}, the current will halve (Ohm's Law: I = V/R). Try it in the simulator!`;
  }
  if (query.includes('double') && query.includes('capacitance') && caps.length > 0) {
    const c = caps[0];
    const currentC = parseFloat(c.params.capacitance) || 100e-6;
    const newC = currentC * 2;
    return `If you double the capacitance, the time constant τ = RC will double. The capacitor will take twice as long to charge. Try it!`;
  }
  if (query.includes('remove')) {
    return 'Removing a component will change the circuit topology. What do you predict will happen? Try it and compare with the simulation.';
  }
  return 'Interesting question! Modify the circuit in the simulator and run it. I\'ll help you analyze the results.';
}

function diagnoseFault(fault, solution) {
  const components = getComponents();
  const comp = components.find(c => c.id === fault.component);
  if (!comp) return 'Fault component not found.';

  switch (fault.active) {
    case 'open':
      return `The ${comp.type} is open — no current flows through it. In your measurements, you'd see 0A through this branch and full voltage across the open component.`;
    case 'short':
      return `The ${comp.type} is shorted — it acts like a wire. Current bypasses the intended path. You'd see excessive current and 0V across the shorted component.`;
    case 'value-drift':
      return `The ${comp.type} value has drifted from its nominal value. Compare the measured behavior with what you'd expect from the labeled value.`;
    case 'reversed':
      return `The ${comp.type} is reversed. For polarized components like LEDs, this means no current flows. Check the polarity.`;
    default:
      return 'There\'s a fault in the circuit. Use your measurements to isolate it.';
  }
}

function comparePrediction(solution) {
  const state = getState();
  const predictions = state.predictions;
  if (predictions.length === 0) return 'No predictions recorded yet. Make a prediction before running the simulation!';

  const last = predictions[predictions.length - 1];
  const error = last.pctError;
  if (error < 5) return `Excellent! Your prediction was within ${error.toFixed(1)}% of the simulated result. Your engineering intuition is strong.`;
  if (error < 15) return `Good effort! Your prediction was within ${error.toFixed(1)}%. Review the concept to improve your intuition.`;
  return `Your prediction was off by ${error.toFixed(1)}%. This is a learning opportunity — review the underlying concept and try again.`;
}

function getContextualResponse(query, state, solution, exp) {
  // Check for misconceptions
  if (query.includes('increase') && query.includes('current') && query.includes('resistance')) {
    return 'Remember: current and resistance are inversely related (I = V/R). Increasing resistance decreases current, not increases it.';
  }
  if (query.includes('voltage') && query.includes('same') && query.includes('parallel')) {
    return 'Correct! In parallel circuits, voltage is the same across all branches. Current divides among the branches.';
  }

  // Default response
  const responses = [
    'I can see your circuit and simulation state. What specific aspect would you like to explore?',
    'Try asking me for a hint, to check your circuit, or what to measure next.',
    'You can also ask "what if" questions to explore circuit behavior.',
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

export function getMentorMessages() { return messages; }
