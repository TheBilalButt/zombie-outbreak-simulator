# ☣️ Zombie Outbreak Simulator — Agent-Based Modeling (ABM)

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://TheBilalButt.github.io/zombie-outbreak-simulator/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Course](https://img.shields.io/badge/Course-Agent--Based%20Modeling-blue?style=for-the-badge)](#)

A real-time, playable **Agent-Based Modeling (ABM)** simulation designed and engineered for Bilal Butt's university Agent-Based Modeling course. Built entirely with Vanilla JavaScript, HTML5 Canvas, and modern CSS without external server dependencies or API costs.

---

## 🌟 Overview & Key Highlights

This simulation models the emergent dynamics of an infectious zombie outbreak in a structured urban environment. Unlike aggregate mathematical models (such as standard differential equation SIR models), this **Agent-Based Model** models each human, zombie, police officer, and medical doctor as an **autonomous entity** making localized decisions based on sensing, state transitions, spatial geography, and probabilistic interaction rules.

### 🎮 Features
- **Procedural City World**: Grid-based urban layout featuring city blocks, buildings (obstacles), roads, hospitals, police stations, supply depots, safe zones, and parks.
- **4 Distinct Autonomous Agent Types**:
  - 🟢 **Survivors (Healthy / Infected / Rescued / Dead)**: Autonomous navigation, fleeing zombies, seeking medical care, gathering supplies, and escaping to safe zones.
  - 🔴 **Zombies**: Sensory detection radius, pursuit vectors, wandering behaviors, and probabilistic bite transmission.
  - 🔵 **Police Officers**: Tactical patrol, survivor protection perimeter, active target engagement, and supply-based ammunition management.
  - 🌸 **Doctors**: Triage pathfinding, hospital anchoring, field healing, and experimental cure administration.
- **Real-Time Interactive Controls**:
  - Live parameter adjustment: population densities, infection probability, zombie movement speed, city resource abundance, and cure research.
  - Runtime event injection: spawn individual survivors, inject zombies, or establish fortified safe zones dynamically.
  - Variable speed multiplier (0.1x to 5.0x) and frame-by-frame stepping.
- **Live Analytics Dashboard**:
  - Continuous telemetry: Healthy, Infected, Dead, Active Zombies, Police, Doctors, Infection Rate, Survival Rate, Rescued Count, and City Supplies.
  - Dynamic population trends charted in real time via Chart.js.
  - Timestamped operational event log tracking critical simulation milestones.
- **⚗️ Side-by-Side Experiment Comparison Mode**:
  - Run headless simulations under identical random seeds to empirically evaluate interventions (e.g., Police containment density, Safe zone fortification, Viral virulence, Cure availability).
- **📖 Built-In ABM Theoretical Guide**:
  - Direct in-app reference covering ABM definitions, individual agent rules, interaction mechanics, state machines, and emergent phenomena.

---

## 🔬 Agent-Based Modeling Formal Specification

### 1. Agents & Internal State Variables

| Agent Type | Visual Indicator | Internal State Variables | Core Behaviors |
| :--- | :--- | :--- | :--- |
| **Survivor** | 🟢 Green (Healthy)<br>🟡 Amber (Infected)<br>⚪ Gray (Dead) | `health` (0–100), `infected` (bool), `incubationTimer`, `hunger` (0–100), `target`, `rescued` | Flee zombies, search for supplies, seek hospital when sick/injured, shelter in safe zones. |
| **Zombie** | 🔴 Red | `speed`, `detectionRadius` (140px), `targetAgent`, `state` (wander / chase) | Sense survivors in range, pursue closest survivor, probabilistic infection upon contact. |
| **Police** | 🔵 Blue | `ammo` (0–12), `range` (110px), `killAccuracy`, `state` (patrol / engage / resupply) | Patrol sectors, engage zombies within range, resupply at police stations when empty. |
| **Doctor** | 🌸 Pink | `medSupplies` (0–10), `cureDoses` (0–3), `healRadius` (45px) | Tend to injured survivors, administer cure to infected patients, restock at hospitals. |

### 2. Micro-Level Decision Rules

```
SURVIVOR RULESET:
IF zombie_in_detection_radius(agent):
    flee_direction = vector_away_from(closest_zombie)
    move(flee_direction, speed * 1.25)
ELSE IF is_infected(agent) AND hospital_exists():
    move_towards(closest_hospital)
ELSE IF hunger > 60:
    move_towards(closest_supply_depot)
ELSE IF safe_zone_in_range():
    move_towards(closest_safe_zone)
ELSE:
    wander_along_roads()

ZOMBIE RULESET:
IF survivor_in_detection_radius(agent):
    move_towards(closest_survivor, speed)
    IF distance_to(closest_survivor) < contact_threshold:
        attempt_infection(target, probability = infectionProb)
ELSE:
    wander_along_roads()
```

### 3. Emergent Macro Behaviors
1. **Percolation Thresholds**: Low initial zombie counts often burn out if police density is above a critical threshold; slight reductions in police trigger exponential epidemic cascades.
2. **Panic Clumping**: Survivors naturally cluster away from danger, accidentally creating high-density feeding grounds for incoming zombie swarms.
3. **Safe Haven Congestion**: Safe zones act as attractors; as survivors funnel into safe zones, zombies naturally encircle the perimeters, creating emergent siege dynamics.

---

## 🚀 Quick Start / How to Run Locally

Because the project is written in pure vanilla web technologies:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/TheBilalButt/zombie-outbreak-simulator.git
   cd zombie-outbreak-simulator
   ```

2. **Open in any modern browser**:
   - Simply double-click `index.html` to open directly in Chrome, Firefox, Edge, or Safari.
   - Or serve with any static HTTP server:
     ```bash
     python -m http.server 8000
     ```
     Then navigate to `http://localhost:8000`.

---

## 📁 Repository Structure

```
zombie-outbreak-simulator/
├── index.html              # Main simulation interface & DOM layout
├── css/
│   └── style.css           # Modern cyber/survival glassmorphism styling
├── js/
│   ├── world.js            # Procedural grid generation & spatial queries
│   ├── agents.js           # Agent classes (Survivor, Zombie, Police, Doctor)
│   ├── simulation.js       # Core ABM engine, tick cycle & statistics
│   ├── renderer.js         # Canvas rendering engine & visual FX
│   ├── ui.js               # Dashboard, Chart.js feeds & comparison modal
│   └── app.js              # Application bootstrapper & event listeners
├── docs/
│   └── abm_report.md       # University academic report for ABM coursework
└── README.md               # Project documentation
```

---

## 📊 Comparison Experiments

The built-in **Comparison Mode** allows running reproducible experiments across 1,500 ticks:

| Experiment | Scenario A | Scenario B | Key ABM Takeaway |
| :--- | :--- | :--- | :--- |
| **Police Response** | 2 Officers | 14 Officers | Demonstrates intervention scaling on reproductive rate ($R_0$). |
| **Fortified Infrastructure** | Scarce Safe Zones | Abundant Safe Zones & Meds | Highlights spatial isolation and structural defense viability. |
| **Viral Virulence** | 15% Infection Rate | 75% Infection Rate | Compares slow endemic burn vs. catastrophic epidemic collapse. |
| **Medical Innovation** | Cure Off | Cure Enabled | Analyzes recovery dynamics and reverse state transitions. |

---

## 👤 Author
- **Bilal Butt** — Computer Science & Agent-Based Modeling
- Developed as a comprehensive ABM university course term project.

## 📄 License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
