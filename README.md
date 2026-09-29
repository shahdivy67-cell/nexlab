# NexLab — AI-Powered Engineering Learning & Simulation Platform

NexLab is an interactive engineering learning environment where students learn by:
**Understanding → Predicting → Building → Simulating → Measuring → Breaking → Diagnosing → Fixing → Explaining → Designing**

## Quick Start

### Run the application

```bash
# From the nexlab directory, start a static file server:
python -m http.server 8080

# Then open in your browser:
# http://localhost:8080
```

### Run the solver tests

```bash
node test/solver.test.mjs
```

## What's Included (v1)

### Simulation Engine (real physics, no fake values)
- **DC analysis** — Modified Nodal Analysis (MNA) with Newton-Raphson iteration for diodes
- **Transient analysis** — Backward Euler time-stepping for RC circuits
- **Component models** — Resistors, capacitors, LEDs (Shockley diode equation), DC sources, switches
- **Equivalent resistance** — Real calculation with sources zeroed

### Circuit Editor
- Canvas-based schematic editor with grid snapping
- Click-to-place components, wire drawing, probe placement
- Pan, zoom, select, delete, rotate
- Component value editing (double-click)
- Real-time current/power display on components

### Virtual Instruments
- **Multimeter** — Voltage, current, resistance, continuity, diode test modes
- **Oscilloscope** — Multi-channel waveform display with V/div, time/div controls

### Learning System
- **Concept pages** — Voltage, current, resistance, power, Ohm's law, series/parallel, Kirchhoff's laws, capacitors, RC circuits
- **Guided experiments** — Predict → Simulate → Measure → Compare → Fault → Diagnose → Fix → Challenge
- **Prediction tracking** — Engineering intuition accuracy per topic
- **Skill graph** — Prerequisite-based skill visualization
- **Lab notebook** — Auto-generated experiment records with export to Markdown

### Missions
- Engineering design challenges with real evaluation criteria
- "Protect the LED", "Current Limiter", "Voltage Divider", "RC Timer"

### AI Mentor
- Context-aware tutoring (sees your circuit, simulation state, and progress)
- Progressive hint system (question → direction → specific → explanation)
- "What if?" mode — modify circuit parameters and see consequences
- Misconception detection from prediction patterns

## Project Structure

```
nexlab/
├── index.html              # App shell with sidebar navigation
├── css/
│   └── style.css           # Dark engineering design system
├── js/
│   ├── main.js             # Router, initialization, global handlers
│   ├── state.js            # localStorage persistence, skill tracking
│   ├── engine/
│   │   ├── linalg.js       # Gaussian elimination solver
│   │   ├── components.js   # Component models & MNA stamps
│   │   ├── circuit.js      # Netlist builder (union-find connectivity)
│   │   └── solver.js       # DC + transient analysis
│   ├── ui/
│   │   ├── dashboard.js    # Home dashboard
│   │   ├── learn.js        # Concept pages
│   │   ├── simulator.js    # Canvas circuit editor
│   │   ├── instruments.js  # Multimeter & oscilloscope
│   │   ├── mentor.js       # AI engineering mentor
│   │   ├── notebook.js     # Lab notebook
│   │   ├── missions.js     # Mission system
│   │   └── skills.js       # Skill graph visualization
│   └── data/
│       ├── concepts.js     # Concept content
│       ├── experiments.js  # Guided experiment definitions
│       └── missions.js     # Mission definitions
└── test/
    └── solver.test.mjs     # Engine verification (14 tests)
```

## Design Principles

1. **Anti-fake** — Every displayed value comes from actual circuit equations
2. **Predict before simulate** — Students commit to a prediction before seeing results
3. **Progressive hints** — AI mentor guides without giving away answers
4. **Fault injection** — Controlled failures teach diagnostic thinking
5. **Engineering intuition** — Track prediction accuracy as a skill metric

## Future Roadmap

- [ ] AC analysis & phasors
- [ ] Transistor models (BJT, MOSFET)
- [ ] Op-amp circuits
- [ ] Digital logic simulation
- [ ] Microcontroller emulation (Arduino-style)
- [ ] Hardware bridge (export code to physical boards)
- [ ] Parameter sweeps & sensitivity analysis
- [ ] Data export (CSV, Python integration)
- [ ] Collaborative projects & teacher dashboard
