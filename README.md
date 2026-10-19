# ☣️ Zombie Outbreak Simulator — Urban Tactical ABM Strategy

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://TheBilalButt.github.io/zombie-outbreak-simulator/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Course](https://img.shields.io/badge/Course-Agent--Based%20Modeling-blue?style=for-the-badge)](#)

A professional, real-time **Agent-Based Modeling (ABM)** zombie survival strategy game designed and engineered for Bilal Butt's university Agent-Based Modeling course. 

Inspired by gritty top-down survival strategy titles (such as *Infected Zone* and *Project Zomboid*), this project replaces primitive placeholders with **anatomically animated characters, emergency vehicles, authentic urban infrastructure, dynamic dark ops lighting, and camera pan/zoom controls** — while fully preserving the underlying Complex Adaptive Systems (CAS) mathematical engine.

---

## 🌟 Visual & Architectural Highlights

### 1. 🚶 Realistic Anatomical Characters (No Primitive Circles)
- **Civilians / Survivors**: Human proportions with customizable clothing, pants, hairstyles, backpacks, animated walking/running leg stride and arm swing, head bobbing, panic shivering, and forward-pointing flashlight beams.
- **Zombies**: Rotting green/gray decaying flesh, torn bloodstained clothes, asymmetrical hunched posture, limping/dragging gait, clawing arms, biting lunges, and permanent blood splatter decals stamped on the pavement.
- **Metro Police**: Crisp dark navy uniform with shoulder epaulets, Kevlar tactical vest with visible "POLICE" lettering, gold shield badge, duty belt with sidearm holster, 9mm pistol with muzzle flash bursts, and forward flashlight vision cones.
- **SWAT Operators**: Heavy matte black ballistic armor, PASGT helmet with visor, curved ballistic riot shield with viewing viewport, red laser sight beam, and submachine gun suppression fire.
- **Military Units**: Woodland/desert digital camouflage BDU, combat helmet with NVG mount, M4 carbine rifle, and tactical checkpoint defense stances.
- **Doctors & Paramedics**: High-vis paramedic turnout jackets with 3M reflective striping / turquoise scrubs, Red Cross medical jump kits, and kneeling triage/bandage animations when treating wounded civilians.
- **Firefighters**: Yellow turnout bunker gear with lime reflective bands, traditional fire helmets with neck flaps, and fire axes.

### 2. 🚓 Emergency & Civilian Vehicles
- **Police Interceptors**: Detailed patrol sedans with front steel push bumpers (bullbars), windshields, rubber tires, headlights, and roof lightbars flashing synchronized **strobe red and blue** LED lighting.
- **Type III Modular Ambulances**: Crisp white chassis with orange/red hazard chevron striping, blue Star of Life cross emblems, and dual flashing amber/red emergency beacons.
- **Abandoned & Crashed Civilian Cars**: Sedans, pickups, and SUVs scattered on roads and parking stalls, featuring broken spiderweb windshield cracks, dented bumpers, and smoke plumes rising from damaged engines.
- **Road Movement & Autonomous Dispatch**: Vehicles navigate the road network with smooth steering angles, responding to 911 horde calls, blaring sirens that attract zombies away from civilians, and deploying personnel.

### 3. 🏙️ Detailed City Environment
- **Multi-Lane Roadways**: Dark asphalt with double yellow centerlines, dashed lane dividers, white crosswalk zebra stripes at intersections, curbs, and sidewalks.
- **St. Jude Metropolitan Hospital**: Large medical complex with a rooftop **Helipad** (yellow 'H' inside landing circle with flashing perimeter beacons) and emergency ambulance bay.
- **Central Police Precinct 4**: Gated compound with communication dish towers, flashing red aircraft hazard strobes, and motor pool parking bays with 'P' markings.
- **Forward Operating Base 'Omega'**: Military checkpoint with sandbag barricades, barbed wire / concertina coils, searchlight towers, and ammo caches.
- **Fortified Sanctuaries**: Wooden palisade log fencing, sandbag gates, and burning 55-gallon steel barrels with animated flickering fire and rising smoke particles.
- **Gnarled Pine & Oak Trees**: Spooky twisting black branch silhouettes with dense leafy canopies casting dark branch shadows on the pavement (inspired by *Infected Zone*).

### 4. 🎥 Professional Camera & HUD Controls
- **Smooth Camera Pan**: Click and drag across the canvas with the mouse or navigate with WASD / Arrow keys.
- **Smooth Zoom**: Zoom smoothly between 0.4x and 2.5x with mouse wheel or HUD `+` / `-` / `1:1` buttons.
- **Tactical Inspection Dossier**: Click any character or vehicle to open an on-screen military dossier panel displaying their name, role badge, live health bar, tactical state, AI objective, and inventory.
- **Dynamic Night Ops Lighting**: Ambient twilight shroud with volumetric vehicle headlights, warm streetlamps, fire barrels, and flashing emergency strobes.
- **Synthesized Web Audio SFX**: Zero-dependency procedural Web Audio sound effects for gunshots, zombie attacks, and medical triage.

---

## 🔬 Agent-Based Modeling Formal Rules

```
CIVILIAN SURVIVOR:
  IF zombie_in_detection_radius(agent):
      flee_vector = -normalize(pos_zombie - pos_agent)
      sprint(flee_vector)
  ELSE IF is_infected(agent) AND hospital_in_range():
      navigate_towards(nearest_hospital)
  ELSE IF hunger > 60:
      navigate_towards(nearest_supply_depot)
  ELSE IF safe_zone_in_range():
      shelter_in(nearest_sanctuary)
  ELSE:
      wander_along_roads()

POLICE & SWAT:
  IF zombie_in_engagement_radius(agent) AND ammo > 0:
      maintain_tactical_distance(target)
      discharge_weapon(target)
  ELSE IF ammo == 0:
      retreat_to(police_precinct_armory)
  ELSE:
      patrol_assigned_sector()

ZOMBIE HOSTILE:
  IF prey_in_detection_radius(agent):
      pursue(closest_prey)
      IF contact:
          deal_damage(prey)
          attempt_viral_transmission(prey, probability = P_inf)
  ELSE IF emergency_siren_in_earshot():
      move_towards(siren_source)
  ELSE:
      limp_wander()
```

---

## 🚀 How to Run Locally

1. **Clone the repository**:
   ```bash
   git clone https://github.com/TheBilalButt/zombie-outbreak-simulator.git
   cd zombie-outbreak-simulator
   ```

2. **Open directly in any modern browser**:
   Double click `index.html` or serve via Python:
   ```bash
   python -m http.server 8000
   ```
   Navigate to `http://localhost:8000`.

---

## 📁 Repository Structure

```
zombie-outbreak-simulator/
├── index.html              # Tactical command interface & canvas layout
├── css/
│   └── style.css           # Modern tactical glassmorphism & HUD styling
├── js/
│   ├── world.js            # City generator, road network, trees & props
│   ├── agents.js           # Survivor, Zombie, Police, SWAT, Military, Doctor, Vehicle classes
│   ├── simulation.js       # ABM tick engine, 911 dispatch, statistics & comparison runner
│   ├── renderer.js         # Canvas rendering engine, dynamic lighting, particles & camera
│   ├── ui.js               # Mission telemetry, Chart.js feeds & inspection dossier
│   └── app.js              # Application bootstrapper, pan/zoom, SFX engine & hotkeys
├── docs/
│   └── abm_report.md       # University academic report for ABM coursework
├── LICENSE                 # MIT License
└── README.md               # Project documentation
```

---

## 👤 Author
- **Bilal Butt** — Computer Science & Agent-Based Modeling Coursework
