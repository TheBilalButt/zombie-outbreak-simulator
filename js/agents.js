/* ═══════════════════════════════════════════════════════════════════
   agents.js — Agent Classes for ABM
   Survivors, Zombies, Police, Doctors with independent state,
   detection radius, and decision-making rules.
   ═══════════════════════════════════════════════════════════════════ */

// ─── Seeded random number generator (Mulberry32) ───
function createRNG(seed) {
    let s = seed | 0;
    return function() {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ─── Utility ───
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function moveToward(agent, tx, ty, speed, world) {
    const dx = tx - agent.x;
    const dy = ty - agent.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const vx = (dx / d) * speed;
    const vy = (dy / d) * speed;
    const nx = agent.x + vx;
    const ny = agent.y + vy;
    if (world.isWalkable(nx, ny)) {
        agent.x = clamp(nx, 4, WORLD_W - 4);
        agent.y = clamp(ny, 4, WORLD_H - 4);
    } else {
        // Try sliding along axis
        if (world.isWalkable(agent.x + vx, agent.y)) {
            agent.x = clamp(agent.x + vx, 4, WORLD_W - 4);
        } else if (world.isWalkable(agent.x, agent.y + vy)) {
            agent.y = clamp(agent.y + vy, 4, WORLD_H - 4);
        }
    }
}

function moveAway(agent, fx, fy, speed, world) {
    const dx = agent.x - fx;
    const dy = agent.y - fy;
    const d = Math.hypot(dx, dy);
    if (d < 0.1) {
        moveToward(agent, agent.x + (Math.random()-0.5)*40, agent.y + (Math.random()-0.5)*40, speed, world);
        return;
    }
    moveToward(agent, agent.x + (dx/d)*30, agent.y + (dy/d)*30, speed, world);
}

function wander(agent, speed, world, rng) {
    if (!agent._wanderTimer || agent._wanderTimer <= 0) {
        agent._wanderTX = agent.x + (rng() - 0.5) * 200;
        agent._wanderTY = agent.y + (rng() - 0.5) * 200;
        agent._wanderTX = clamp(agent._wanderTX, 10, WORLD_W - 10);
        agent._wanderTY = clamp(agent._wanderTY, 10, WORLD_H - 10);
        agent._wanderTimer = 60 + Math.floor(rng() * 120);
    }
    agent._wanderTimer--;
    moveToward(agent, agent._wanderTX, agent._wanderTY, speed * 0.5, world);
}

// ═════════════════════════════════════════════════════════════
// SURVIVOR
// ═════════════════════════════════════════════════════════════
class Survivor {
    constructor(x, y, rng) {
        this.type = 'survivor';
        this.x = x;
        this.y = y;
        this.health = 100;
        this.maxHealth = 100;
        this.speed = 1.0 + rng() * 0.6;
        this.infected = false;
        this.infectionTimer = 0;       // ticks until turning
        this.infectionDuration = 300 + Math.floor(rng() * 300); // 5-10 sec at 60fps
        this.dead = false;
        this.turned = false;           // becomes zombie
        this.fear = 0;                 // 0-100
        this.stamina = 100;
        this.inSafeZone = false;
        this.rescued = false;
        this.detectionRadius = 80 + rng() * 40;
        this._rng = rng;
        this._wanderTimer = 0;
        this._wanderTX = x;
        this._wanderTY = y;
        this._fleeCooldown = 0;
    }

    update(world, agents, params) {
        if (this.dead || this.turned || this.rescued) return;

        this.inSafeZone = world.isInSafeZone(this.x, this.y);

        // Infection progression
        if (this.infected) {
            this.infectionTimer++;
            this.health -= 0.08;
            if (this.infectionTimer >= this.infectionDuration) {
                if (this._rng() < 0.6) {
                    this.turned = true; // becomes zombie
                } else {
                    this.dead = true;
                }
                return;
            }
        }

        if (this.health <= 0) {
            this.dead = true;
            return;
        }

        // Stamina recovery
        if (this.inSafeZone) {
            this.stamina = Math.min(100, this.stamina + 0.3);
            this.fear = Math.max(0, this.fear - 0.5);
        }

        // Find nearest zombie
        let nearestZombie = null, nearestZDist = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < this.detectionRadius && d < nearestZDist) {
                    nearestZDist = d;
                    nearestZombie = a;
                }
            }
        }

        // Decision tree
        if (nearestZombie && nearestZDist < this.detectionRadius) {
            // FLEE from zombie
            this.fear = Math.min(100, this.fear + 2);
            const fleeSpeed = this.speed * (1 + this.fear / 200);
            moveAway(this, nearestZombie.x, nearestZombie.y, fleeSpeed, world);
            this.stamina = Math.max(0, this.stamina - 0.15);
        } else if (this.health < 50 && !this.inSafeZone) {
            // Seek hospital or safe zone
            const hosp = world.getClosest(world.hospitals, this.x, this.y);
            const safe = world.getClosest(world.safeZones, this.x, this.y);
            const target = (hosp && safe) ? (dist(this, hosp) < dist(this, safe) ? hosp : safe) : (hosp || safe);
            if (target) {
                moveToward(this, target.x, target.y, this.speed, world);
            } else {
                wander(this, this.speed, world, this._rng);
            }
        } else if (this.fear > 30 && !this.inSafeZone) {
            // Move toward nearest safe zone
            const safe = world.getClosest(world.safeZones, this.x, this.y);
            if (safe) {
                moveToward(this, safe.x, safe.y, this.speed, world);
            } else {
                wander(this, this.speed, world, this._rng);
            }
            this.fear = Math.max(0, this.fear - 0.1);
        } else {
            // Wander
            wander(this, this.speed, world, this._rng);
            this.fear = Math.max(0, this.fear - 0.2);
        }

        // Healing in hospital
        if (world.isInHospital(this.x, this.y) && !this.infected) {
            this.health = Math.min(this.maxHealth, this.health + 0.5);
        }

        // Rescue check: in safe zone and healthy for a while
        if (this.inSafeZone && !this.infected && this.health > 80) {
            if (!this._rescueCounter) this._rescueCounter = 0;
            this._rescueCounter++;
            if (this._rescueCounter > 300) { // ~5 seconds in safe zone
                this.rescued = true;
            }
        } else {
            this._rescueCounter = 0;
        }
    }
}

// ═════════════════════════════════════════════════════════════
// ZOMBIE
// ═════════════════════════════════════════════════════════════
class Zombie {
    constructor(x, y, rng, speed) {
        this.type = 'zombie';
        this.x = x;
        this.y = y;
        this.speed = speed || (0.8 + rng() * 0.5);
        this.health = 60 + rng() * 40;
        this.dead = false;
        this.detectionRadius = 100 + rng() * 40;
        this._rng = rng;
        this._wanderTimer = 0;
        this._target = null;
        this._loseTrackDist = 160;
    }

    update(world, agents, params) {
        if (this.dead) return;
        if (this.health <= 0) { this.dead = true; return; }

        // If tracking a target, check if still in range
        if (this._target) {
            if (this._target.dead || this._target.turned || this._target.rescued || dist(this, this._target) > this._loseTrackDist) {
                this._target = null;
            }
        }

        // Find nearest living survivor
        if (!this._target) {
            let best = null, bestD = Infinity;
            for (const a of agents) {
                if ((a.type === 'survivor' && !a.dead && !a.turned && !a.rescued) ||
                    (a.type === 'police' && !a.dead) ||
                    (a.type === 'doctor' && !a.dead)) {
                    const d = dist(this, a);
                    if (d < this.detectionRadius && d < bestD) {
                        bestD = d;
                        best = a;
                    }
                }
            }
            this._target = best;
        }

        if (this._target) {
            moveToward(this, this._target.x, this._target.y, this.speed, world);

            // Attempt infection on close contact
            const contactDist = 10;
            if (dist(this, this._target) < contactDist) {
                if (this._target.type === 'survivor' && !this._target.infected && !this._target.dead) {
                    let infProb = params.infectionProb;
                    // Safe zone reduces infection by 80%
                    if (this._target.inSafeZone) infProb *= 0.2;
                    if (this._rng() < infProb) {
                        this._target.infected = true;
                        this._target.health -= 15;
                        return 'infected';
                    }
                } else if (this._target.type === 'doctor' && !this._target.dead) {
                    // Zombies can injure doctors
                    this._target.health -= 5;
                }
            }
        } else {
            wander(this, this.speed, world, this._rng);
        }
        return null;
    }
}

// ═════════════════════════════════════════════════════════════
// POLICE
// ═════════════════════════════════════════════════════════════
class Police {
    constructor(x, y, rng) {
        this.type = 'police';
        this.x = x;
        this.y = y;
        this.health = 120;
        this.speed = 1.4 + rng() * 0.3;
        this.ammo = 15 + Math.floor(rng() * 10);
        this.dead = false;
        this.detectionRadius = 120;
        this.engageRange = 50;
        this._rng = rng;
        this._wanderTimer = 0;
        this._patrolTarget = null;
    }

    update(world, agents, params) {
        if (this.dead) return;
        if (this.health <= 0) { this.dead = true; return null; }

        // Find nearest zombie
        let nearestZ = null, nearestZD = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < this.detectionRadius && d < nearestZD) {
                    nearestZD = d;
                    nearestZ = a;
                }
            }
        }

        if (nearestZ && this.ammo > 0) {
            if (nearestZD < this.engageRange) {
                // Shoot zombie
                nearestZ.health -= 25 + this._rng() * 15;
                this.ammo--;
                if (nearestZ.health <= 0) {
                    nearestZ.dead = true;
                    return 'zombie_killed';
                }
            } else {
                // Move toward zombie
                moveToward(this, nearestZ.x, nearestZ.y, this.speed, world);
            }
        } else {
            // Patrol between key areas
            if (!this._patrolTarget || dist(this, this._patrolTarget) < 20) {
                const areas = [...world.safeZones, ...world.hospitals, ...world.policeStations];
                if (areas.length > 0) {
                    this._patrolTarget = areas[Math.floor(this._rng() * areas.length)];
                }
            }
            if (this._patrolTarget) {
                moveToward(this, this._patrolTarget.x, this._patrolTarget.y, this.speed * 0.7, world);
            } else {
                wander(this, this.speed, world, this._rng);
            }
        }
        return null;
    }
}

// ═════════════════════════════════════════════════════════════
// DOCTOR
// ═════════════════════════════════════════════════════════════
class Doctor {
    constructor(x, y, rng) {
        this.type = 'doctor';
        this.x = x;
        this.y = y;
        this.health = 80;
        this.speed = 1.0 + rng() * 0.3;
        this.medSupplies = 10 + Math.floor(rng() * 5);
        this.cureDoses = 3;
        this.dead = false;
        this.detectionRadius = 100;
        this._rng = rng;
        this._wanderTimer = 0;
    }

    update(world, agents, params) {
        if (this.dead) return;
        if (this.health <= 0) { this.dead = true; return null; }

        // Find nearest injured/infected survivor
        let target = null, bestPriority = Infinity;
        for (const a of agents) {
            if (a.type === 'survivor' && !a.dead && !a.turned && !a.rescued) {
                const d = dist(this, a);
                if (d < this.detectionRadius) {
                    // Prioritize infected over just hurt
                    let priority = d;
                    if (a.infected) priority -= 50;
                    if (a.health < 50) priority -= 30;
                    if (priority < bestPriority) {
                        bestPriority = priority;
                        target = a;
                    }
                }
            }
        }

        // Flee from nearby zombies
        let nearestZ = null, nearestZD = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < 60 && d < nearestZD) {
                    nearestZD = d;
                    nearestZ = a;
                }
            }
        }
        if (nearestZ && nearestZD < 40) {
            moveAway(this, nearestZ.x, nearestZ.y, this.speed * 1.2, world);
            return null;
        }

        if (target) {
            const d = dist(this, target);
            if (d < 15) {
                // Heal
                if (target.infected && params.cureEnabled && this.cureDoses > 0) {
                    target.infected = false;
                    target.infectionTimer = 0;
                    target.health = Math.min(target.maxHealth, target.health + 30);
                    this.cureDoses--;
                    return 'cured';
                } else if (!target.infected && this.medSupplies > 0 && target.health < target.maxHealth) {
                    target.health = Math.min(target.maxHealth, target.health + 20);
                    this.medSupplies--;
                    return 'healed';
                }
            } else {
                moveToward(this, target.x, target.y, this.speed, world);
            }
        } else {
            // Move toward hospital
            const hosp = world.getClosest(world.hospitals, this.x, this.y);
            if (hosp && dist(this, hosp) > 30) {
                moveToward(this, hosp.x, hosp.y, this.speed * 0.6, world);
            } else {
                wander(this, this.speed, world, this._rng);
            }
        }
        return null;
    }
}
