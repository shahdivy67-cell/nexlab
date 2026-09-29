// NexLab — Concept content for the Learn section

export const CONCEPTS = [
  {
    id: 'voltage',
    title: 'Voltage',
    category: 'Electronics',
    difficulty: 'beginner',
    summary: 'Electrical potential difference — the "pressure" that drives current.',
    formula: 'V = W / Q',
    formulaLabel: 'Voltage = Energy per unit charge',
    explanation: `Voltage is the electrical potential difference between two points. It represents the work done per unit charge to move a charge between those points.

Think of it like water pressure in a pipe: higher pressure pushes more water through. Similarly, higher voltage pushes more current through a conductor.

The unit of voltage is the **volt (V)**, named after Alessandro Volta.`,
    keyPoints: [
      'Voltage is always measured between two points',
      'It is the driving force for current',
      'Unit: volt (V)',
      'A 12V source maintains 12V across its terminals',
    ],
    experiment: 'ohms-law',
    prerequisites: [],
  },
  {
    id: 'current',
    title: 'Current',
    category: 'Electronics',
    difficulty: 'beginner',
    summary: 'The flow of electric charge through a conductor.',
    formula: 'I = Q / t',
    formulaLabel: 'Current = Charge per unit time',
    explanation: `Electric current is the rate of flow of electric charge through a conductor. One ampere (A) means one coulomb of charge passes a point per second.

Current flows from higher potential to lower potential (conventional current). In a circuit, current is what does the work — lighting LEDs, driving motors, powering chips.`,
    keyPoints: [
      'Current is the flow of charge',
      'Unit: ampere (A)',
      'Conventional current flows from + to −',
      'Current is measured in series',
    ],
    experiment: 'ohms-law',
    prerequisites: ['voltage'],
  },
  {
    id: 'resistance',
    title: 'Resistance',
    category: 'Electronics',
    difficulty: 'beginner',
    summary: 'Opposition to current flow — controls how much current flows.',
    formula: 'R = ρL / A',
    formulaLabel: 'Resistance depends on material and geometry',
    explanation: `Resistance is the opposition to current flow. A resistor converts electrical energy into heat. The resistance of a conductor depends on its material (resistivity ρ), length (L), and cross-sectional area (A).

Longer and thinner wires have higher resistance. This is why power lines are thick — to minimize resistance and power loss.`,
    keyPoints: [
      'Resistance opposes current flow',
      'Unit: ohm (Ω)',
      'Resistors dissipate power as heat',
      'Longer/thinner = more resistance',
    ],
    experiment: 'ohms-law',
    prerequisites: ['voltage', 'current'],
  },
  {
    id: 'power',
    title: 'Power',
    category: 'Electronics',
    difficulty: 'beginner',
    summary: 'The rate at which electrical energy is transferred.',
    formula: 'P = V × I',
    formulaLabel: 'Power = Voltage × Current',
    explanation: `Electrical power is the rate at which energy is transferred. It is the product of voltage and current.

A 12V circuit delivering 2A transfers 24W of power. This power might become light (LED), motion (motor), heat (resistor), or sound (speaker).

Power ratings matter: a resistor rated for 0.25W will overheat if asked to dissipate 1W.`,
    keyPoints: [
      'Power = Voltage × Current',
      'Unit: watt (W)',
      'Power ratings prevent component damage',
      'Efficiency = useful power / total power',
    ],
    experiment: 'ohms-law',
    prerequisites: ['voltage', 'current'],
  },
  {
    id: 'ohms-law',
    title: "Ohm's Law",
    category: 'Electronics',
    difficulty: 'beginner',
    summary: 'The fundamental relationship between voltage, current, and resistance.',
    formula: 'V = I × R',
    formulaLabel: 'Voltage = Current × Resistance',
    explanation: `Ohm's Law is the foundation of circuit analysis. It states that the voltage across a resistor is proportional to the current through it, with resistance as the constant of proportionality.

If you know any two quantities, you can find the third:
- V = I × R (find voltage)
- I = V / R (find current)
- R = V / I (find resistance)`,
    keyPoints: [
      'V = I × R relates all three quantities',
      'Doubling voltage doubles current (R constant)',
      'Doubling resistance halves current (V constant)',
      'Foundation of all circuit analysis',
    ],
    experiment: 'ohms-law',
    prerequisites: ['voltage', 'current', 'resistance'],
  },
  {
    id: 'series',
    title: 'Series Circuits',
    category: 'Electronics',
    difficulty: 'intermediate',
    summary: 'Components connected end-to-end — same current, divided voltage.',
    formula: 'R_total = R₁ + R₂ + R₃ + ...',
    formulaLabel: 'Total resistance is the sum',
    explanation: `In a series circuit, components are connected in a single path. The same current flows through all components, but the voltage is divided among them.

The total resistance is the sum of individual resistances. This means series resistance is always greater than any individual resistor.`,
    keyPoints: [
      'Same current through all components',
      'Voltage divides proportionally to resistance',
      'R_total = R₁ + R₂ + ...',
      'One open component breaks the entire circuit',
    ],
    experiment: 'series',
    prerequisites: ['ohms-law'],
  },
  {
    id: 'parallel',
    title: 'Parallel Circuits',
    category: 'Electronics',
    difficulty: 'intermediate',
    summary: 'Components connected across the same two points — same voltage, divided current.',
    formula: '1/R_total = 1/R₁ + 1/R₂ + 1/R₃ + ...',
    formulaLabel: 'Reciprocal of total resistance',
    explanation: `In a parallel circuit, components share the same two nodes. The voltage across each branch is the same, but current divides among the branches.

The total resistance is always less than the smallest individual resistor. Adding more parallel paths decreases total resistance and increases total current.`,
    keyPoints: [
      'Same voltage across all branches',
      'Current divides among branches',
      'R_total < smallest individual R',
      'Adding paths decreases total resistance',
    ],
    experiment: 'parallel',
    prerequisites: ['ohms-law'],
  },
  {
    id: 'kirchhoff',
    title: "Kirchhoff's Laws",
    category: 'Electronics',
    difficulty: 'intermediate',
    summary: 'Conservation laws for current and voltage in circuits.',
    formula: 'ΣI = 0 (nodes)  |  ΣV = 0 (loops)',
    formulaLabel: 'KCL: current in = current out  |  KVL: voltage rises = voltage drops',
    explanation: `Kirchhoff's Current Law (KCL): The sum of currents entering a node equals the sum leaving. Charge is conserved.

Kirchhoff's Voltage Law (KVL): The sum of voltage rises equals the sum of voltage drops around any closed loop. Energy is conserved.

These two laws are the foundation of all circuit analysis, from simple voltage dividers to complex multi-loop circuits.`,
    keyPoints: [
      'KCL: current is conserved at nodes',
      'KVL: voltage is conserved around loops',
      'Used to solve any circuit',
      'Basis of nodal and mesh analysis',
    ],
    experiment: 'kirchhoff',
    prerequisites: ['series', 'parallel'],
  },
  {
    id: 'capacitors',
    title: 'Capacitors',
    category: 'Electronics',
    difficulty: 'intermediate',
    summary: 'Components that store energy in an electric field.',
    formula: 'Q = C × V',
    formulaLabel: 'Charge = Capacitance × Voltage',
    explanation: `A capacitor stores electrical energy in an electric field between two conductive plates separated by an insulator.

When voltage is applied, charge accumulates on the plates. The capacitance (C) determines how much charge is stored per volt. Capacitors block DC current but pass AC signals.

Key property: voltage across a capacitor cannot change instantaneously.`,
    keyPoints: [
      'Stores energy in an electric field',
      'Unit: farad (F)',
      'Blocks DC, passes AC',
      'Voltage cannot change instantaneously',
    ],
    experiment: 'rc-circuits',
    prerequisites: ['voltage', 'current'],
  },
  {
    id: 'rc-circuits',
    title: 'RC Circuits',
    category: 'Electronics',
    difficulty: 'intermediate',
    summary: 'Resistor-capacitor circuits — timing, filtering, and transients.',
    formula: 'τ = R × C',
    formulaLabel: 'Time constant = Resistance × Capacitance',
    explanation: `An RC circuit combines a resistor and capacitor. The time constant τ = R × C determines how quickly the capacitor charges or discharges.

After one time constant, the capacitor reaches 63.2% of its final voltage. After 5τ, it is considered fully charged (99.3%).

RC circuits are everywhere: timing circuits, filters, debounce circuits, and power supply smoothing.`,
    keyPoints: [
      'τ = R × C is the time constant',
      '63.2% charged after 1τ',
      '99.3% charged after 5τ',
      'Used for timing, filtering, and smoothing',
    ],
    experiment: 'rc-circuits',
    prerequisites: ['capacitors', 'ohms-law'],
  },
];

export const CATEGORIES = [
  { id: 'electronics', name: 'Electronics', icon: '⚡' },
  { id: 'electrical', name: 'Electrical Engineering', icon: '🔌' },
  { id: 'embedded', name: 'Embedded Systems', icon: '🔧' },
  { id: 'robotics', name: 'Robotics', icon: '🤖' },
];
