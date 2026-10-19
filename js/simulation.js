/* ═══════════════════════════════════════════════════════════════════
   simulation.js — Core Agent-Based Modeling Simulation Engine
   Manages tick lifecycle, multi-agent behavioral updates, emergency
   dispatch logic, live metrics calculation, and headless comparison runs.
   ═══════════════════════════════════════════════════════════════════ */

class Simulation {
    constructor(config, seed) {
        this.seed = seed || 42;
        this.rng = createRNG(this.seed);
        this.config = Object.assign({
            survivors: 60,
            zombies: 10,
            police: 6,
            swat: 3,
            military: 4,
            doctors: 4,
            firefighters: 2,
            policeCars: 2,
            ambulances: 1,
            infectionProb: 0.35,
            zombieSpeed: 1.2,
            resources: 50,
            cureEnabled: false,
        }, config);

        this.world = new World();
        this.agents = [];
        this.tick = 0;
        this.running = false;
        this.paused = false;
        this.speed = 1.0;
        this.events = [];
        this.history = [];
        this.stats = {};
        this.totalInitialSurvivors = 0;
        this.rescuedCount = 0;

        this._init();
    }

    _init() {
        this.agents = [];
        this.tick = 0;
        this.events = [];
        this.history = [];
        this.rescuedCount = 0;

        const rng = this.rng;
        const w = this.world;

        // 1. Spawn Survivors across urban sidewalks and roads
        for (let i = 0; i < this.config.survivors; i++) {
            const pos = w.getRandomRoadPos(rng);
            this.agents.push(new Survivor(pos.x, pos.y, createRNG(this.seed + i + 1000)));
        }
        this.totalInitialSurvivors = this.config.survivors;

        // 2. Spawn Outbreak Zero Zombies
        for (let i = 0; i < this.config.zombies; i++) {
            const pos = w.getRandomRoadPos(rng);
            this.agents.push(new Zombie(pos.x, pos.y, createRNG(this.seed + i + 2000), this.config.zombieSpeed));
        }

        // 3. Spawn Metro Police Officers
        for (let i = 0; i < this.config.police; i++) {
            const pos = w.policeStations.length > 0 ?
                { x: w.policeStations[0].x + (rng() - 0.5) * 50, y: w.policeStations[0].y + (rng() - 0.5) * 50 } :
                w.getRandomRoadPos(rng);
            this.agents.push(new Police(pos.x, pos.y, createRNG(this.seed + i + 3000)));
        }

        // 4. Spawn SWAT Tactical Operators
        for (let i = 0; i < (this.config.swat || 3); i++) {
            const pos = w.policeStations.length > 0 ?
                { x: w.policeStations[0].x + (rng() - 0.5) * 60, y: w.policeStations[0].y + (rng() - 0.5) * 60 } :
                w.getRandomRoadPos(rng);
            this.agents.push(new SWAT(pos.x, pos.y, createRNG(this.seed + i + 3500)));
        }

        // 5. Spawn Military Checkpoint Defense
        for (let i = 0; i < (this.config.military || 4); i++) {
            const pos = w.militaryCheckpoints.length > 0 ?
                { x: w.militaryCheckpoints[0].x + (rng() - 0.5) * 60, y: w.militaryCheckpoints[0].y + (rng() - 0.5) * 60 } :
                w.getRandomRoadPos(rng);
            this.agents.push(new Military(pos.x, pos.y, createRNG(this.seed + i + 4000)));
        }

        // 6. Spawn Doctors & Paramedics near Hospital
        for (let i = 0; i < this.config.doctors; i++) {
            const pos = w.hospitals.length > 0 ?
                { x: w.hospitals[0].x + (rng() - 0.5) * 50, y: w.hospitals[0].y + (rng() - 0.5) * 50 } :
                w.getRandomRoadPos(rng);
            this.agents.push(new Doctor(pos.x, pos.y, createRNG(this.seed + i + 4500)));
        }

        // 7. Spawn Firefighters
        for (let i = 0; i < (this.config.firefighters || 2); i++) {
            const pos = w.getRandomRoadPos(rng);
            this.agents.push(new Firefighter(pos.x, pos.y, createRNG(this.seed + i + 5000)));
        }

        // 8. Spawn Police Interceptors & Ambulances on Roads
        for (let i = 0; i < (this.config.policeCars || 2); i++) {
            const pos = w.policeStations.length > 0 ?
                { x: w.policeStations[0].motorPool.x + i * 35, y: w.policeStations[0].motorPool.y } :
                w.getRandomRoadPos(rng);
            this.agents.push(new Vehicle(pos.x, pos.y, 'police_car', createRNG(this.seed + i + 6000)));
        }

        for (let i = 0; i < (this.config.ambulances || 1); i++) {
            const pos = w.hospitals.length > 0 ?
                { x: w.hospitals[0].erBay.x, y: w.hospitals[0].erBay.y } :
                w.getRandomRoadPos(rng);
            this.agents.push(new Vehicle(pos.x, pos.y, 'ambulance', createRNG(this.seed + i + 6500)));
        }

        this._calcStats();
        this._addEvent('info', 'Urban tactical simulation deployed');
    }

    reset(config) {
        if (config) this.config = Object.assign(this.config, config);
        this.rng = createRNG(this.seed);
        this.world = new World();
        this.running = false;
        this.paused = false;
        this._init();
    }

    start() {
        this.running = true;
        this.paused = false;
        if (this.tick === 0) {
            this._addEvent('danger', 'OUTBREAK DETECTED: Containment protocol initiated!');
        }
    }

    pause() { this.paused = !this.paused; }

    step() {
        this._tick();
    }

    _tick() {
        this.tick++;
        const params = {
            infectionProb: this.config.infectionProb,
            cureEnabled: this.config.cureEnabled,
        };

        // 1. Update Autonomous Agents
        for (let i = this.agents.length - 1; i >= 0; i--) {
            const agent = this.agents[i];
            let result = null;

            if (agent.isVehicle) {
                agent.update(this.world, this.agents);
            } else if (agent.type === 'survivor') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'turned') {
                    // Turn into a new Zombie
                    const z = new Zombie(agent.x, agent.y, createRNG(this.seed + this.tick), this.config.zombieSpeed);
                    this.agents.push(z);
                    this._addEvent('danger', `Biohazard: ${agent.name} has turned into a zombie!`);
                } else if (result === 'rescued' && !agent._rescueLogged) {
                    agent._rescueLogged = true;
                    this.rescuedCount++;
                    this._addEvent('good', `Evacuation: ${agent.name} reached fortified sanctuary.`);
                }
            } else if (agent.type === 'zombie') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'infected') {
                    this._addEvent('danger', 'Pathogen Transmission: Civilian bitten and infected!');
                }
            } else if (agent.type === 'police' || agent.type === 'swat' || agent.type === 'military' || agent.type === 'firefighter') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'zombie_killed') {
                    this._addEvent('good', `${agent.name} eliminated a hostile zombie!`);
                }
            } else if (agent.type === 'doctor') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'cured') {
                    this._addEvent('good', `Medical Breakthrough: ${agent.name} administered cure!`);
                }
            }
        }

        // 2. Emergency Response Triggers (911 Dispatch Dynamics)
        if (this.tick % 180 === 0) {
            // Find areas with high zombie concentration and dispatch police cruisers
            const activeCruiser = this.agents.find(a => a.isVehicle && a.type === 'police_car');
            const activeHorde = this.agents.find(a => a.type === 'zombie' && !a.dead);
            if (activeCruiser && activeHorde && !activeCruiser.dispatched) {
                activeCruiser.targetDestination = { x: activeHorde.x, y: activeHorde.y };
                activeCruiser.currentGoal = "Responding to priority 911 horde call!";
                this._addEvent('warn', 'Police Dispatch: Unit responding to 911 distress call.');
            }
        }

        this._calcStats();

        // Record metrics history for Chart.js
        if (this.tick % 10 === 0) {
            this.history.push({
                tick: this.tick,
                healthy: this.stats.healthy,
                infected: this.stats.infected,
                dead: this.stats.dead,
                zombies: this.stats.zombies,
            });
        }
    }

    _calcStats() {
        let healthy = 0, infected = 0, dead = 0, zombies = 0;
        let policeCount = 0, swatCount = 0, militaryCount = 0, docCount = 0;

        for (const a of this.agents) {
            if (a.type === 'survivor') {
                if (a.dead) dead++;
                else if (a.turned) { /* counted as zombie */ }
                else if (a.rescued) { /* counted in rescuedCount */ }
                else if (a.infected) infected++;
                else healthy++;
            } else if (a.type === 'zombie') {
                if (!a.dead) zombies++;
            } else if (a.type === 'police' && !a.dead) {
                policeCount++;
            } else if (a.type === 'swat' && !a.dead) {
                swatCount++;
            } else if (a.type === 'military' && !a.dead) {
                militaryCount++;
            } else if (a.type === 'doctor' && !a.dead) {
                docCount++;
            }
        }

        const aliveSurvivors = healthy + infected;
        this.stats = {
            healthy,
            infected,
            dead,
            zombies,
            police: policeCount,
            swat: swatCount,
            military: militaryCount,
            doctors: docCount,
            rescued: this.rescuedCount,
            infectionRate: aliveSurvivors > 0 ? Math.round((infected / aliveSurvivors) * 100) : 0,
            survivalRate: this.totalInitialSurvivors > 0 ? Math.round(((healthy + this.rescuedCount) / this.totalInitialSurvivors) * 100) : 0,
            time: this.tick,
        };
    }

    _addEvent(type, msg) {
        const mins = Math.floor(this.tick / 60 / 60);
        const secs = Math.floor(this.tick / 60) % 60;
        const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
        this.events.unshift({ time: timeStr, type, msg });
        if (this.events.length > 50) this.events.length = 50;
    }

    // Dynamic Live Additions
    addSurvivor() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Survivor(pos.x, pos.y, createRNG(this.seed + this.tick + 7000)));
        this.totalInitialSurvivors++;
        this._addEvent('info', 'Civilian refugee appeared');
    }

    addZombie() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Zombie(pos.x, pos.y, createRNG(this.seed + this.tick + 8000), this.config.zombieSpeed));
        this._addEvent('danger', 'New zombie infected sighted!');
    }

    addPolice() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Police(pos.x, pos.y, createRNG(this.seed + this.tick + 9000)));
        this._addEvent('good', 'Police officer deployed on patrol');
    }

    addSWAT() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new SWAT(pos.x, pos.y, createRNG(this.seed + this.tick + 9500)));
        this._addEvent('good', 'Tactical SWAT operator deployed');
    }

    addMilitary() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Military(pos.x, pos.y, createRNG(this.seed + this.tick + 10000)));
        this._addEvent('good', 'Military reinforcement arrived');
    }

    addPoliceCar() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Vehicle(pos.x, pos.y, 'police_car', createRNG(this.seed + this.tick + 11000)));
        this._addEvent('good', 'Police interceptor dispatched');
    }

    addAmbulance() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Vehicle(pos.x, pos.y, 'ambulance', createRNG(this.seed + this.tick + 12000)));
        this._addEvent('good', 'Ambulance deployed for medical aid');
    }

    addSafeZone() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.world.addSafeZone(pos.x, pos.y);
        this._addEvent('good', 'Fortified field shelter erected');
    }

    getFormattedTime() {
        const totalSecs = Math.floor(this.tick / 60);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
}

// ═══════════════════════════════════════════════════════════════════
// Headless simulation runner for side-by-side comparison experiments
// ═══════════════════════════════════════════════════════════════════
function runHeadless(config, seed, maxTicks) {
    const sim = new Simulation(config, seed);
    sim.start();
    for (let i = 0; i < maxTicks; i++) {
        sim.step();
    }
    return {
        stats: { ...sim.stats },
        history: [...sim.history],
        events: sim.events.slice(0, 10),
        ticks: sim.tick,
    };
}
