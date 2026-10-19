/* ═══════════════════════════════════════════════════════════════════
   simulation.js — Core Simulation Engine
   Manages tick loop, agent lifecycle, statistics, and events.
   ═══════════════════════════════════════════════════════════════════ */

class Simulation {
    constructor(config, seed) {
        this.seed = seed || 42;
        this.rng = createRNG(this.seed);
        this.config = Object.assign({
            survivors: 60,
            zombies: 8,
            police: 6,
            doctors: 4,
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
        this.history = [];       // [{tick, healthy, infected, dead, zombies}]
        this.stats = {};
        this.totalInitialSurvivors = 0;
        this.rescuedCount = 0;
        this.totalAmmo = 0;
        this.totalMeds = 0;

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

        // Spawn survivors
        for (let i = 0; i < this.config.survivors; i++) {
            const pos = w.getRandomRoadPos(rng);
            this.agents.push(new Survivor(pos.x, pos.y, createRNG(this.seed + i + 1000)));
        }
        this.totalInitialSurvivors = this.config.survivors;

        // Spawn zombies
        for (let i = 0; i < this.config.zombies; i++) {
            const pos = w.getRandomRoadPos(rng);
            this.agents.push(new Zombie(pos.x, pos.y, createRNG(this.seed + i + 2000), this.config.zombieSpeed));
        }

        // Spawn police
        for (let i = 0; i < this.config.police; i++) {
            const pos = w.getRandomRoadPos(rng);
            this.agents.push(new Police(pos.x, pos.y, createRNG(this.seed + i + 3000)));
        }

        // Spawn doctors
        for (let i = 0; i < this.config.doctors; i++) {
            // Place doctors near hospitals
            let pos;
            if (w.hospitals.length > 0) {
                const h = w.hospitals[i % w.hospitals.length];
                pos = { x: h.x + (rng() - 0.5) * 40, y: h.y + (rng() - 0.5) * 40 };
            } else {
                pos = w.getRandomRoadPos(rng);
            }
            this.agents.push(new Doctor(pos.x, pos.y, createRNG(this.seed + i + 4000)));
        }

        this._calcStats();
        this._addEvent('info', 'Outbreak simulation initialized');
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
            this._addEvent('danger', 'OUTBREAK STARTED — Zombies are loose in the city!');
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

        // Update all agents
        for (const agent of this.agents) {
            let result = null;
            if (agent.type === 'survivor') {
                agent.update(this.world, this.agents, params);
                // Check if survivor turned into zombie
                if (agent.turned) {
                    const z = new Zombie(agent.x, agent.y, createRNG(this.seed + this.tick), this.config.zombieSpeed);
                    this.agents.push(z);
                    this._addEvent('danger', 'A survivor has TURNED into a zombie!');
                }
                if (agent.rescued && !agent._rescueLogged) {
                    agent._rescueLogged = true;
                    this.rescuedCount++;
                    this._addEvent('good', 'A survivor has been RESCUED to safety!');
                }
            } else if (agent.type === 'zombie') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'infected') {
                    this._addEvent('danger', 'A survivor has been INFECTED!');
                }
            } else if (agent.type === 'police') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'zombie_killed') {
                    this._addEvent('good', 'Police ELIMINATED a zombie!');
                }
            } else if (agent.type === 'doctor') {
                result = agent.update(this.world, this.agents, params);
                if (result === 'cured') {
                    this._addEvent('good', 'Doctor CURED an infected survivor!');
                } else if (result === 'healed') {
                    this._addEvent('info', 'Doctor healed an injured survivor.');
                }
            }
        }

        this._calcStats();

        // Record history every 10 ticks
        if (this.tick % 10 === 0) {
            this.history.push({
                tick: this.tick,
                healthy: this.stats.healthy,
                infected: this.stats.infected,
                dead: this.stats.dead,
                zombies: this.stats.zombies,
            });
        }

        // Milestone events
        if (this.tick === 300) this._addEvent('warn', '5 seconds elapsed — check infection spread');
        if (this.stats.infectionRate > 50 && !this._halfInfected) {
            this._halfInfected = true;
            this._addEvent('danger', 'CRITICAL: Over 50% infection rate!');
        }
        if (this.stats.zombies === 0 && this.tick > 60 && !this._allZombiesDead) {
            this._allZombiesDead = true;
            this._addEvent('good', 'ALL ZOMBIES ELIMINATED — City is safe!');
        }
        if (this.stats.healthy === 0 && this.stats.infected === 0 && !this._allDead) {
            this._allDead = true;
            this._addEvent('danger', 'EXTINCTION — No survivors remain.');
        }
    }

    _calcStats() {
        let healthy = 0, infected = 0, dead = 0, zombies = 0;
        let policeAlive = 0, doctorsAlive = 0;
        let totalAmmo = 0, totalMeds = 0, totalCures = 0;

        for (const a of this.agents) {
            if (a.type === 'survivor') {
                if (a.dead) dead++;
                else if (a.turned) { /* counted as zombie */ }
                else if (a.rescued) { /* counted in rescuedCount */ }
                else if (a.infected) infected++;
                else healthy++;
            } else if (a.type === 'zombie') {
                if (!a.dead) zombies++;
            } else if (a.type === 'police') {
                if (!a.dead) { policeAlive++; totalAmmo += a.ammo; }
            } else if (a.type === 'doctor') {
                if (!a.dead) { doctorsAlive++; totalMeds += a.medSupplies; totalCures += a.cureDoses; }
            }
        }

        const totalSurvivors = healthy + infected + dead + this.rescuedCount;
        const aliveSurvivors = healthy + infected;

        this.stats = {
            healthy,
            infected,
            dead,
            zombies,
            police: policeAlive,
            doctors: doctorsAlive,
            rescued: this.rescuedCount,
            ammo: totalAmmo,
            meds: totalMeds,
            cures: totalCures,
            infectionRate: aliveSurvivors > 0 ? Math.round((infected / (aliveSurvivors)) * 100) : 0,
            survivalRate: this.totalInitialSurvivors > 0 ? Math.round(((healthy + this.rescuedCount) / this.totalInitialSurvivors) * 100) : 0,
            time: this.tick,
        };
        this.totalAmmo = totalAmmo;
        this.totalMeds = totalMeds;
    }

    _addEvent(type, msg) {
        const mins = Math.floor(this.tick / 60 / 60);
        const secs = Math.floor(this.tick / 60) % 60;
        const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
        this.events.unshift({ time: timeStr, type, msg });
        if (this.events.length > 50) this.events.length = 50;
    }

    addSurvivor() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Survivor(pos.x, pos.y, createRNG(this.seed + this.tick + 5000)));
        this.totalInitialSurvivors++;
        this._addEvent('info', 'New survivor appeared');
    }

    addZombie() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.agents.push(new Zombie(pos.x, pos.y, createRNG(this.seed + this.tick + 6000), this.config.zombieSpeed));
        this._addEvent('danger', 'New zombie appeared!');
    }

    addSafeZone() {
        const pos = this.world.getRandomRoadPos(this.rng);
        this.world.addSafeZone(pos.x, pos.y);
        this._addEvent('good', 'New safe zone established');
    }

    getFormattedTime() {
        const totalSecs = Math.floor(this.tick / 60);
        const m = Math.floor(totalSecs / 60);
        const s = totalSecs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }
}

// ═══════════════════════════════════════════════════════════
// Headless simulation for comparison experiments
// ═══════════════════════════════════════════════════════════
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
