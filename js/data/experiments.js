// NexLab — Guided experiment definitions
// Each experiment follows the learning loop: predict → build → simulate → measure → break → diagnose → fix

export const EXPERIMENTS = [
  {
    id: 'ohms-law',
    title: "Ohm's Law",
    concept: 'ohms-law',
    difficulty: 'beginner',
    duration: '10 min',
    objective: 'Understand the relationship between voltage, current, and resistance.',
    components: ['dc_source', 'resistor', 'ground', 'wire'],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'r1', type: 'resistor', x: 300, y: 200, rotation: 0, params: { resistance: '6' } },
        { id: 'g1', type: 'ground', x: 450, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 260, y: 200 }] },
        { id: 'w2', points: [{ x: 340, y: 200 }, { x: 450, y: 200 }] },
        { id: 'w3', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 450, y: 350 }, { x: 450, y: 200 }] },
      ],
    },
    steps: [
      {
        type: 'predict',
        question: 'A 12V source is connected to a 6Ω resistor. What current do you expect?',
        unit: 'A',
        tolerance: 0.1,
        answer: 2.0,
        hint: 'Use Ohm\'s Law: I = V / R',
      },
      {
        type: 'simulate',
        instruction: 'Run the simulation and measure the current through the resistor.',
        measurement: 'current',
        component: 'r1',
      },
      {
        type: 'observe',
        instruction: 'Change the resistance to 12Ω. Predict the new current, then simulate.',
        newParams: { r1: { resistance: '12' } },
        predictQuestion: 'What current do you expect with 12Ω?',
        predictUnit: 'A',
        predictAnswer: 1.0,
      },
      {
        type: 'fault',
        fault: { type: 'open', component: 'r1' },
        symptom: 'The current has dropped to 0A. The resistor appears to be disconnected.',
        instruction: 'Diagnose the problem. What happened to the circuit?',
      },
      {
        type: 'fix',
        instruction: 'Fix the circuit by replacing the faulty resistor.',
        verification: { type: 'current', component: 'r1', min: 1.8, max: 2.2 },
      },
      {
        type: 'challenge',
        question: 'Design a circuit that limits current to 100mA from a 12V supply.',
        requirements: [
          { type: 'current', max: 0.1 },
          { type: 'power', component: 'r1', max: 0.5 },
        ],
      },
    ],
  },
  {
    id: 'series',
    title: 'Series Circuits',
    concept: 'series',
    difficulty: 'intermediate',
    duration: '15 min',
    objective: 'Understand how voltage and current behave in series circuits.',
    components: ['dc_source', 'resistor', 'ground', 'wire'],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'r1', type: 'resistor', x: 300, y: 200, rotation: 0, params: { resistance: '4' } },
        { id: 'r2', type: 'resistor', x: 450, y: 200, rotation: 0, params: { resistance: '8' } },
        { id: 'g1', type: 'ground', x: 600, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 260, y: 200 }] },
        { id: 'w2', points: [{ x: 340, y: 200 }, { x: 410, y: 200 }] },
        { id: 'w3', points: [{ x: 490, y: 200 }, { x: 600, y: 200 }] },
        { id: 'w4', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 600, y: 350 }, { x: 600, y: 200 }] },
      ],
    },
    steps: [
      {
        type: 'predict',
        question: 'Two resistors (4Ω and 8Ω) are in series with a 12V source. What is the total resistance?',
        unit: 'Ω',
        tolerance: 0.5,
        answer: 12,
        hint: 'In series: R_total = R₁ + R₂',
      },
      {
        type: 'predict',
        question: 'What current flows through the circuit?',
        unit: 'A',
        tolerance: 0.1,
        answer: 1.0,
        hint: 'I = V / R_total',
      },
      {
        type: 'simulate',
        instruction: 'Run the simulation. Measure the voltage across each resistor.',
        measurements: [
          { component: 'r1', quantity: 'voltage' },
          { component: 'r2', quantity: 'voltage' },
        ],
      },
      {
        type: 'observe',
        instruction: 'Verify Kirchhoff\'s Voltage Law: V_source = V_R1 + V_R2.',
      },
      {
        type: 'fault',
        fault: { type: 'short', component: 'r2' },
        symptom: 'The current has increased. R2 appears to be shorted.',
        instruction: 'Diagnose: why did the current increase?',
      },
      {
        type: 'fix',
        instruction: 'Replace R2 with a proper 8Ω resistor.',
        verification: { type: 'current', component: 'r1', min: 0.9, max: 1.1 },
      },
    ],
  },
  {
    id: 'parallel',
    title: 'Parallel Circuits',
    concept: 'parallel',
    difficulty: 'intermediate',
    duration: '15 min',
    objective: 'Understand how voltage and current behave in parallel circuits.',
    components: ['dc_source', 'resistor', 'ground', 'wire'],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'r1', type: 'resistor', x: 300, y: 150, rotation: 0, params: { resistance: '6' } },
        { id: 'r2', type: 'resistor', x: 300, y: 250, rotation: 0, params: { resistance: '3' } },
        { id: 'g1', type: 'ground', x: 500, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 260, y: 150 }, { x: 260, y: 250 }] },
        { id: 'w2', points: [{ x: 340, y: 150 }, { x: 500, y: 150 }, { x: 500, y: 250 }, { x: 340, y: 250 }] },
        { id: 'w3', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 500, y: 350 }, { x: 500, y: 200 }] },
      ],
    },
    steps: [
      {
        type: 'predict',
        question: 'Two resistors (6Ω and 3Ω) are in parallel with a 12V source. What is the total resistance?',
        unit: 'Ω',
        tolerance: 0.2,
        answer: 2.0,
        hint: 'In parallel: 1/R_total = 1/R₁ + 1/R₂',
      },
      {
        type: 'predict',
        question: 'What is the total current from the source?',
        unit: 'A',
        tolerance: 0.2,
        answer: 6.0,
        hint: 'I_total = V / R_total',
      },
      {
        type: 'simulate',
        instruction: 'Run the simulation. Measure the current through each resistor.',
        measurements: [
          { component: 'r1', quantity: 'current' },
          { component: 'r2', quantity: 'current' },
        ],
      },
      {
        type: 'observe',
        instruction: 'Verify Kirchhoff\'s Current Law: I_total = I_R1 + I_R2.',
      },
      {
        type: 'fault',
        fault: { type: 'open', component: 'r2' },
        symptom: 'The total current has decreased. One branch is open.',
        instruction: 'Diagnose: which branch is open and why?',
      },
      {
        type: 'fix',
        instruction: 'Replace the open resistor.',
        verification: { type: 'current', component: 'r1', min: 1.8, max: 2.2 },
      },
    ],
  },
  {
    id: 'rc-circuits',
    title: 'RC Charging',
    concept: 'rc-circuits',
    difficulty: 'intermediate',
    duration: '20 min',
    objective: 'Observe capacitor charging and understand the time constant.',
    components: ['dc_source', 'resistor', 'capacitor', 'ground', 'wire'],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'r1', type: 'resistor', x: 300, y: 200, rotation: 0, params: { resistance: '1000' } },
        { id: 'c1', type: 'capacitor', x: 450, y: 200, rotation: 0, params: { capacitance: '100u' } },
        { id: 'g1', type: 'ground', x: 600, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 260, y: 200 }] },
        { id: 'w2', points: [{ x: 340, y: 200 }, { x: 410, y: 200 }] },
        { id: 'w3', points: [{ x: 490, y: 200 }, { x: 600, y: 200 }] },
        { id: 'w4', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 600, y: 350 }, { x: 600, y: 200 }] },
      ],
    },
    steps: [
      {
        type: 'predict',
        question: 'R = 1kΩ, C = 100µF. What is the time constant τ?',
        unit: 's',
        tolerance: 0.02,
        answer: 0.1,
        hint: 'τ = R × C',
      },
      {
        type: 'predict',
        question: 'After one time constant, what percentage of the final voltage will the capacitor reach?',
        unit: '%',
        tolerance: 2,
        answer: 63.2,
        hint: 'The capacitor charges to 63.2% in one τ',
      },
      {
        type: 'simulate',
        instruction: 'Run the transient simulation. Observe the capacitor voltage on the oscilloscope.',
        measurement: 'transient',
        component: 'c1',
      },
      {
        type: 'observe',
        instruction: 'Measure the time for the capacitor to reach 63.2% of 12V (7.58V).',
      },
      {
        type: 'fault',
        fault: { type: 'value-drift', component: 'r1', newResistance: '10000' },
        symptom: 'The capacitor is charging much more slowly than expected.',
        instruction: 'Diagnose: what changed in the circuit?',
      },
      {
        type: 'fix',
        instruction: 'Replace R1 with the correct 1kΩ resistor.',
        verification: { type: 'time-constant', min: 0.08, max: 0.12 },
      },
    ],
  },
  {
    id: 'kirchhoff',
    title: "Kirchhoff's Laws",
    concept: 'kirchhoff',
    difficulty: 'advanced',
    duration: '25 min',
    objective: 'Apply KCL and KVL to analyze a multi-loop circuit.',
    components: ['dc_source', 'resistor', 'ground', 'wire'],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'r1', type: 'resistor', x: 300, y: 150, rotation: 0, params: { resistance: '4' } },
        { id: 'r2', type: 'resistor', x: 300, y: 250, rotation: 0, params: { resistance: '6' } },
        { id: 'r3', type: 'resistor', x: 450, y: 200, rotation: 0, params: { resistance: '8' } },
        { id: 'g1', type: 'ground', x: 600, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 260, y: 150 }, { x: 260, y: 250 }] },
        { id: 'w2', points: [{ x: 340, y: 150 }, { x: 410, y: 150 }, { x: 410, y: 250 }, { x: 340, y: 250 }] },
        { id: 'w3', points: [{ x: 490, y: 200 }, { x: 600, y: 200 }] },
        { id: 'w4', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 600, y: 350 }, { x: 600, y: 200 }] },
      ],
    },
    steps: [
      {
        type: 'predict',
        question: 'This circuit has two loops. How many independent KVL equations can you write?',
        unit: '',
        tolerance: 0,
        answer: 2,
        hint: 'Number of independent loops = branches - nodes + 1',
      },
      {
        type: 'simulate',
        instruction: 'Run the simulation. Measure all branch currents and voltages.',
        measurements: [
          { component: 'r1', quantity: 'current' },
          { component: 'r2', quantity: 'current' },
          { component: 'r3', quantity: 'current' },
        ],
      },
      {
        type: 'observe',
        instruction: 'Verify KCL at the junction: I_in = I_R1 + I_R2.',
      },
      {
        type: 'observe',
        instruction: 'Verify KVL around the outer loop: V_source = V_R1 + V_R3.',
      },
      {
        type: 'fault',
        fault: { type: 'wrong-value', component: 'r2', newResistance: '60' },
        symptom: 'The current through R2 is much lower than expected.',
        instruction: 'Diagnose: what is wrong with R2?',
      },
      {
        type: 'fix',
        instruction: 'Replace R2 with the correct 6Ω resistor.',
        verification: { type: 'current', component: 'r2', min: 1.5, max: 2.5 },
      },
    ],
  },
];
