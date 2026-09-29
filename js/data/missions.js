// NexLab — Mission definitions: engineering design challenges
// Each mission has real evaluation criteria checked against the simulation.

export const MISSIONS = [
  {
    id: 'protect-the-led',
    title: 'Protect the LED',
    difficulty: 'beginner',
    xp: 100,
    skills: ['ohms-law', 'power'],
    description: `Design a circuit that safely powers an LED from a 12V supply.

The LED must receive 10–20mA of current. The current-limiting resistor must not exceed its 0.5W power rating.`,
    requirements: [
      { type: 'current', component: 'led1', min: 0.010, max: 0.020, label: 'LED current: 10–20mA' },
      { type: 'power', component: 'r1', max: 0.5, label: 'Resistor power < 0.5W' },
    ],
    availableComponents: ['dc_source', 'resistor', 'led', 'ground', 'wire'],
    hints: [
      'What voltage remains across the resistor? (12V − V_LED)',
      'Use Ohm\'s Law: R = V_resistor / I_target',
      'Check power: P = I² × R',
    ],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'led1', type: 'led', x: 450, y: 200, rotation: 0, params: { vf: '2' } },
        { id: 'g1', type: 'ground', x: 600, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 410, y: 200 }] },
        { id: 'w2', points: [{ x: 490, y: 200 }, { x: 600, y: 200 }] },
        { id: 'w3', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 600, y: 350 }, { x: 600, y: 200 }] },
      ],
    },
  },
  {
    id: 'current-limiter',
    title: 'Current Limiter',
    difficulty: 'intermediate',
    xp: 150,
    skills: ['ohms-law', 'series'],
    description: `Design a circuit that limits current to exactly 100mA from a 12V supply.

You must use a single resistor. The resistor must handle the power dissipation safely.`,
    requirements: [
      { type: 'current', component: 'load', min: 0.095, max: 0.105, label: 'Current: 95–105mA' },
      { type: 'power', component: 'r1', max: 2.0, label: 'Resistor power < 2W' },
    ],
    availableComponents: ['dc_source', 'resistor', 'ground', 'wire'],
    hints: [
      'R = V / I = 12V / 0.1A',
      'What power will the resistor dissipate?',
      'Choose the nearest standard resistor value',
    ],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'load', type: 'resistor', x: 450, y: 200, rotation: 0, params: { resistance: '1' } },
        { id: 'g1', type: 'ground', x: 600, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 190, y: 200 }, { x: 410, y: 200 }] },
        { id: 'w2', points: [{ x: 490, y: 200 }, { x: 600, y: 200 }] },
        { id: 'w3', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 600, y: 350 }, { x: 600, y: 200 }] },
      ],
    },
  },
  {
    id: 'voltage-divider',
    title: 'Voltage Divider',
    difficulty: 'intermediate',
    xp: 150,
    skills: ['series', 'ohms-law'],
    description: `Design a voltage divider that produces exactly 5V from a 12V supply.

The output must be stable and the divider should not waste excessive power.`,
    requirements: [
      { type: 'voltage', node: 'out', min: 4.8, max: 5.2, label: 'Output voltage: 4.8–5.2V' },
      { type: 'power', max: 0.5, label: 'Total divider power < 0.5W' },
    ],
    availableComponents: ['dc_source', 'resistor', 'ground', 'wire'],
    hints: [
      'V_out = V_in × R₂ / (R₁ + R₂)',
      'For 5V from 12V: R₂ / (R₁ + R₂) = 5/12',
      'Try R₁ = 7kΩ, R₂ = 5kΩ',
    ],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '12' } },
        { id: 'g1', type: 'ground', x: 450, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 450, y: 350 }, { x: 450, y: 200 }] },
      ],
    },
  },
  {
    id: 'rc-timer',
    title: 'RC Timer',
    difficulty: 'advanced',
    xp: 200,
    skills: ['rc-circuits', 'capacitors'],
    description: `Design an RC circuit that takes exactly 2 seconds to charge to 63.2% of the supply voltage.

Use a 5V supply. Choose appropriate R and C values.`,
    requirements: [
      { type: 'time-constant', min: 1.8, max: 2.2, label: 'Time constant: 1.8–2.2s' },
    ],
    availableComponents: ['dc_source', 'resistor', 'capacitor', 'ground', 'wire'],
    hints: [
      'τ = R × C',
      'For τ = 2s: try R = 100kΩ, C = 20µF',
      'Or R = 200kΩ, C = 10µF',
    ],
    setup: {
      components: [
        { id: 's1', type: 'dc_source', x: 150, y: 200, rotation: 0, params: { voltage: '5' } },
        { id: 'g1', type: 'ground', x: 450, y: 200, rotation: 0, params: {} },
      ],
      wires: [
        { id: 'w1', points: [{ x: 110, y: 200 }, { x: 110, y: 350 }, { x: 450, y: 350 }, { x: 450, y: 200 }] },
      ],
    },
  },
];
