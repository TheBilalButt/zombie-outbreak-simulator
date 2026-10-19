/* ═══════════════════════════════════════════════════════════════════
   agents.js — Detailed Character & Emergency Vehicle Agents
   Realistic autonomous entities with state machines, animation cycles,
   directional heading, tactical combat, and vehicle driving systems.
   ═══════════════════════════════════════════════════════════════════ */

// ─── Deterministic Seeded PRNG (Mulberry32) ───
function createRNG(seed) {
    let s = (seed | 0) || 12345;
    return function() {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ s >>> 15, 1 | s);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function angleBetween(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

function moveTowardAngle(agent, targetAngle, speed, world) {
    // Smooth angular turning
    let diff = targetAngle - agent.angle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    agent.angle += diff * 0.15;

    const vx = Math.cos(agent.angle) * speed;
    const vy = Math.sin(agent.angle) * speed;
    const nx = agent.x + vx;
    const ny = agent.y + vy;

    if (world.isWalkable(nx, ny)) {
        agent.x = clamp(nx, 8, WORLD_W - 8);
        agent.y = clamp(ny, 8, WORLD_H - 8);
        agent.animTimer += speed * 0.2;
        return true;
    } else {
        // Slide along wall
        if (world.isWalkable(agent.x + vx, agent.y)) {
            agent.x = clamp(agent.x + vx, 8, WORLD_W - 8);
            agent.animTimer += speed * 0.1;
        } else if (world.isWalkable(agent.x, agent.y + vy)) {
            agent.y = clamp(agent.y + vy, 8, WORLD_H - 8);
            agent.animTimer += speed * 0.1;
        }
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 1. SURVIVOR AGENT
// ═══════════════════════════════════════════════════════════════════
const FIRST_NAMES = ["Liam", "Emma", "Noah", "Olivia", "Ethan", "Sophia", "Lucas", "Mia", "Aiden", "Isabella", "Marcus", "Elena"];
const LAST_NAMES = ["Vance", "Chen", "Miller", "Ross", "Kowalski", "Patel", "Gomez", "Taylor", "Brooks", "Kim"];

class Survivor {
    constructor(x, y, rng) {
        this.id = 'surv_' + Math.random().toString(36).substring(2, 8);
        this.type = 'survivor';
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;
        this.name = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)] + " " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];

        // Visual Customization
        this.clothingColor = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#ec4899'][Math.floor(rng() * 7)];
        this.pantsColor = ['#1e293b', '#334155', '#475569', '#1e1b4b'][Math.floor(rng() * 4)];
        this.hairColor = ['#451a03', '#1c1917', '#78350f', '#d97706'][Math.floor(rng() * 4)];
        this.hasBackpack = rng() > 0.35;
        this.backpackColor = '#b45309';

        // State & Attributes
        this.health = 100;
        this.maxHealth = 100;
        this.hunger = rng() * 30; // 0 (full) to 100 (starving)
        this.speed = 1.35;
        this.fleeSpeed = 2.1;
        this.fear = 0; // 0 to 100
        this.detectionRadius = 140;
        this.flashlight = true;

        // Lifecycle Flags
        this.infected = false;
        this.infectionTimer = 0;
        this.infectionDuration = 600 + Math.floor(rng() * 400); // 10-16 seconds to turn
        this.turned = false;
        this.rescued = false;
        this.dead = false;
        this.inSafeZone = false;
        this.currentGoal = "Wandering in search of survivors";

        // Animation
        this.animTimer = rng() * 10;
        this.state = 'idle'; // 'idle', 'walk', 'run', 'scared', 'eat', 'bandage'
    }

    update(world, agents, params) {
        if (this.dead || this.turned || this.rescued) return null;

        // 1. Check Safe Zone Sanctuary
        this.inSafeZone = world.isInSafeZone(this.x, this.y);
        if (this.inSafeZone) {
            this.fear = Math.max(0, this.fear - 1.5);
            this.hunger = Math.max(0, this.hunger - 0.05);
            if (this.health < this.maxHealth) this.health += 0.05;
            this.currentGoal = "Sheltered in fortified Safe Zone";

            // If healthy inside safe zone for sustained time, count as rescued
            if (!this.infected && this.health > 70 && this.rng() < 0.0008) {
                this.rescued = true;
                return 'rescued';
            }
        } else {
            this.hunger += 0.02;
            if (this.hunger > 90) this.health -= 0.08;
        }

        // 2. Infection Progression
        if (this.infected) {
            this.infectionTimer++;
            this.health -= 0.04;
            this.currentGoal = `Infected! Turning in ${Math.max(0, Math.round((this.infectionDuration - this.infectionTimer)/60))}s`;
            if (this.infectionTimer >= this.infectionDuration || this.health <= 0) {
                this.turned = true;
                return 'turned';
            }
        }

        // 3. Scan for nearby Threats (Zombies)
        let closestZombie = null;
        let minDist = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < this.detectionRadius && d < minDist) {
                    minDist = d;
                    closestZombie = a;
                }
            }
        }

        // 4. Decision Tree: Flee vs Seek Hospital vs Forage vs Seek Safe Zone
        if (closestZombie) {
            // Panic & Flee
            this.fear = Math.min(100, this.fear + 10);
            this.state = 'run';
            this.currentGoal = "Fleeing from zombie!";
            const awayAngle = angleBetween(closestZombie, this) + (this.rng() - 0.5) * 0.4;
            moveTowardAngle(this, awayAngle, this.fleeSpeed, world);
            return null;
        }

        this.fear = Math.max(0, this.fear - 0.5);

        // If infected, prioritize running to the nearest Hospital for medical aid
        if (this.infected && world.hospitals.length > 0) {
            const h = world.getClosest(world.hospitals, this.x, this.y);
            if (h) {
                this.state = 'walk';
                this.currentGoal = "Rushing to Emergency Hospital";
                const ang = angleBetween(this, h);
                moveTowardAngle(this, ang, this.speed * 1.15, world);
                return null;
            }
        }

        // If hungry, seek the nearest Supply Depot
        if (this.hunger > 60 && world.supplyDepots.length > 0) {
            const s = world.getClosest(world.supplyDepots, this.x, this.y);
            if (s) {
                const d = dist(this, s);
                if (d < 30) {
                    this.hunger = Math.max(0, this.hunger - 40);
                    this.state = 'eat';
                    this.currentGoal = "Gathering food rations";
                    return null;
                }
                this.state = 'walk';
                this.currentGoal = "Searching for food supplies";
                moveTowardAngle(this, angleBetween(this, s), this.speed, world);
                return null;
            }
        }

        // If safe zone nearby, navigate toward it
        if (!this.inSafeZone && world.safeZones.length > 0) {
            const sz = world.getClosest(world.safeZones, this.x, this.y);
            if (sz && dist(this, sz) < 320) {
                this.state = 'walk';
                this.currentGoal = "Moving toward safe zone perimeter";
                moveTowardAngle(this, angleBetween(this, sz), this.speed, world);
                return null;
            }
        }

        // Default: Autonomous Wander along roads/sidewalks
        this.state = 'walk';
        this.currentGoal = "Scouting neighborhood";
        if (this.rng() < 0.04) {
            this.targetAngle = this.angle + (this.rng() - 0.5) * 1.8;
        }
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.8, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 2. ZOMBIE AGENT
// ═══════════════════════════════════════════════════════════════════
class Zombie {
    constructor(x, y, rng, speedMult = 1.0) {
        this.id = 'zomb_' + Math.random().toString(36).substring(2, 8);
        this.type = 'zombie';
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;

        // Visual Variety
        this.variant = rng() < 0.2 ? 'runner' : (rng() < 0.85 ? 'walker' : 'bloater');
        this.skinColor = ['#65a30d', '#4d7c0f', '#52796f', '#354f52'][Math.floor(rng() * 4)];
        this.shirtColor = ['#7f1d1d', '#991b1b', '#374151', '#1f2937'][Math.floor(rng() * 4)];
        this.limpCycle = rng() * 10;

        // Stats
        this.baseSpeed = this.variant === 'runner' ? 2.1 : (this.variant === 'bloater' ? 0.9 : 1.3);
        this.speed = this.baseSpeed * (speedMult || 1.0);
        this.health = this.variant === 'bloater' ? 180 : 80;
        this.maxHealth = this.health;
        this.detectionRadius = this.variant === 'runner' ? 170 : 130;
        this.dead = false;
        this.currentGoal = "Wandering in search of flesh";

        // Attack & Animation
        this.animTimer = rng() * 10;
        this.isAttacking = false;
        this.attackCooldown = 0;
    }

    update(world, agents, params) {
        if (this.dead) return null;
        if (this.attackCooldown > 0) this.attackCooldown--;

        // 1. Scan for closest human prey (Survivors, Police, Doctors, etc.)
        let closestPrey = null;
        let minDist = Infinity;

        for (const a of agents) {
            if (a.type !== 'zombie' && !a.dead && !a.turned && !a.rescued) {
                const d = dist(this, a);
                if (d < this.detectionRadius && d < minDist) {
                    minDist = d;
                    closestPrey = a;
                }
            }
        }

        // 2. Check nearby Emergency Vehicle Sirens (drawn to loud sounds)
        let closestSound = null;
        let minSoundDist = 280;
        for (const a of agents) {
            if (a.isVehicle && a.sirenActive) {
                const d = dist(this, a);
                if (d < minSoundDist) {
                    minSoundDist = d;
                    closestSound = a;
                }
            }
        }

        // 3. Pursuit Behavior
        if (closestPrey) {
            this.currentGoal = `Hunting ${closestPrey.name || closestPrey.type}`;
            const targetAngle = angleBetween(this, closestPrey);
            moveTowardAngle(this, targetAngle, this.speed * 1.15, world);

            // Contact: Attack & Attempt Infection
            if (minDist < 14 && this.attackCooldown === 0) {
                this.isAttacking = true;
                this.attackCooldown = 40;
                closestPrey.health -= 25;
                world.addBloodDecal(closestPrey.x, closestPrey.y, 6);

                if (closestPrey.health <= 0) {
                    closestPrey.dead = true;
                    world.addBloodDecal(closestPrey.x, closestPrey.y, 14);
                    return 'kill';
                }

                // Check infection probability
                let infProb = params.infectionProb || 0.35;
                if (closestPrey.inSafeZone) infProb *= 0.2; // 80% reduction in safe zone
                if (closestPrey.type === 'swat') infProb *= 0.3; // Armor protection

                if (this.rng() < infProb && !closestPrey.infected) {
                    closestPrey.infected = true;
                    closestPrey.infectionTimer = 0;
                    return 'infected';
                }
            } else {
                this.isAttacking = false;
            }
            return null;
        }

        // Drawn to siren sound
        if (closestSound) {
            this.currentGoal = "Attracted by police/ambulance sirens";
            moveTowardAngle(this, angleBetween(this, closestSound), this.speed * 0.9, world);
            return null;
        }

        // Default: Stumble & Limp Wander
        this.currentGoal = "Shuffling aimlessly";
        this.isAttacking = false;
        if (this.rng() < 0.03) {
            this.targetAngle = this.angle + (this.rng() - 0.5) * 2.2;
        }
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.6, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 3. POLICE OFFICER AGENT
// ═══════════════════════════════════════════════════════════════════
class Police {
    constructor(x, y, rng) {
        this.id = 'pol_' + Math.random().toString(36).substring(2, 8);
        this.type = 'police';
        this.name = "Officer " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        this.badgeNumber = Math.floor(1000 + rng() * 9000);
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;

        // Tactical Gear & Attributes
        this.health = 100;
        this.maxHealth = 100;
        this.ammo = 15;
        this.maxAmmo = 15;
        this.speed = 1.4;
        this.engagementRadius = 140;
        this.gunRange = 130;
        this.firingCooldown = 0;
        this.dead = false;
        this.muzzleFlash = 0;
        this.assignedSector = null;
        this.currentGoal = "Patrolling sector perimeter";
        this.animTimer = rng() * 10;
    }

    update(world, agents, params) {
        if (this.dead) return null;
        if (this.firingCooldown > 0) this.firingCooldown--;
        if (this.muzzleFlash > 0) this.muzzleFlash--;

        // 1. Scan for nearest threat in range
        let targetZombie = null;
        let minDist = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < this.engagementRadius && d < minDist) {
                    minDist = d;
                    targetZombie = a;
                }
            }
        }

        // 2. Reload if empty and at police station
        if (this.ammo <= 0) {
            const ps = world.getClosest(world.policeStations, this.x, this.y);
            if (ps) {
                this.currentGoal = "Out of ammo! Retreating to precinct to restock";
                moveTowardAngle(this, angleBetween(this, ps), this.speed * 1.2, world);
                if (dist(this, ps) < 35) {
                    this.ammo = this.maxAmmo;
                }
                return null;
            }
        }

        // 3. Combat Engagement
        if (targetZombie && this.ammo > 0) {
            this.angle = angleBetween(this, targetZombie);
            this.currentGoal = `Engaging threat (${Math.round(minDist)}px)`;

            // Maintain tactical distance (don't rush into melee)
            if (minDist > 70) {
                moveTowardAngle(this, this.angle, this.speed, world);
            } else if (minDist < 45) {
                // Backpedal while shooting
                moveTowardAngle(this, this.angle + Math.PI, this.speed * 0.9, world);
            }

            // Fire sidearm
            if (this.firingCooldown === 0) {
                this.firingCooldown = 18;
                this.muzzleFlash = 4;
                this.ammo--;

                // Hit probability
                if (this.rng() < 0.82) {
                    targetZombie.health -= 35;
                    world.addBloodDecal(targetZombie.x, targetZombie.y, 5);
                    if (targetZombie.health <= 0) {
                        targetZombie.dead = true;
                        world.addBloodDecal(targetZombie.x, targetZombie.y, 12);
                        return 'zombie_killed';
                    }
                }
            }
            return null;
        }

        // 4. Default: Defensive Patrol
        this.currentGoal = "Patrolling urban district";
        if (this.rng() < 0.03) {
            this.targetAngle = this.angle + (this.rng() - 0.5) * 1.5;
        }
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.75, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 4. SWAT TACTICAL OPERATOR
// ═══════════════════════════════════════════════════════════════════
class SWAT {
    constructor(x, y, rng) {
        this.id = 'swat_' + Math.random().toString(36).substring(2, 8);
        this.type = 'swat';
        this.name = "SWAT " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;

        // Heavy Tactical Gear
        this.health = 160;
        this.maxHealth = 160;
        this.ammo = 30;
        this.maxAmmo = 30;
        this.hasShield = true;
        this.speed = 1.2;
        this.engagementRadius = 150;
        this.firingCooldown = 0;
        this.muzzleFlash = 0;
        this.laserActive = true;
        this.dead = false;
        this.currentGoal = "Forming tactical breach perimeter";
        this.animTimer = rng() * 10;
    }

    update(world, agents, params) {
        if (this.dead) return null;
        if (this.firingCooldown > 0) this.firingCooldown--;
        if (this.muzzleFlash > 0) this.muzzleFlash--;

        let targetZombie = null;
        let minDist = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < this.engagementRadius && d < minDist) {
                    minDist = d;
                    targetZombie = a;
                }
            }
        }

        if (targetZombie && this.ammo > 0) {
            this.angle = angleBetween(this, targetZombie);
            this.currentGoal = "Suppressing zombie swarm";

            if (minDist > 50) moveTowardAngle(this, this.angle, this.speed, world);

            // Submachine Gun Burst
            if (this.firingCooldown === 0) {
                this.firingCooldown = 12;
                this.muzzleFlash = 3;
                this.ammo--;

                if (this.rng() < 0.88) {
                    targetZombie.health -= 45;
                    world.addBloodDecal(targetZombie.x, targetZombie.y, 6);
                    if (targetZombie.health <= 0) {
                        targetZombie.dead = true;
                        world.addBloodDecal(targetZombie.x, targetZombie.y, 14);
                        return 'zombie_killed';
                    }
                }
            }
            return null;
        }

        this.currentGoal = "Sweeping sector with ballistic shield";
        if (this.rng() < 0.02) this.targetAngle = this.angle + (this.rng() - 0.5) * 1.2;
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.7, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 5. MILITARY SOLDIER
// ═══════════════════════════════════════════════════════════════════
class Military {
    constructor(x, y, rng) {
        this.id = 'mil_' + Math.random().toString(36).substring(2, 8);
        this.type = 'military';
        this.name = "Sgt. " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;

        this.health = 140;
        this.maxHealth = 140;
        this.ammo = 40;
        this.maxAmmo = 40;
        this.speed = 1.3;
        this.engagementRadius = 180;
        this.firingCooldown = 0;
        this.muzzleFlash = 0;
        this.dead = false;
        this.currentGoal = "Guarding military checkpoint perimeter";
        this.animTimer = rng() * 10;
    }

    update(world, agents, params) {
        if (this.dead) return null;
        if (this.firingCooldown > 0) this.firingCooldown--;
        if (this.muzzleFlash > 0) this.muzzleFlash--;

        let target = null;
        let minDist = Infinity;
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                const d = dist(this, a);
                if (d < this.engagementRadius && d < minDist) {
                    minDist = d;
                    target = a;
                }
            }
        }

        if (target && this.ammo > 0) {
            this.angle = angleBetween(this, target);
            this.currentGoal = "Engaging hostile hostiles at long range";

            // Heavy Assault Rifle Fire
            if (this.firingCooldown === 0) {
                this.firingCooldown = 10;
                this.muzzleFlash = 3;
                this.ammo--;

                if (this.rng() < 0.90) {
                    target.health -= 50;
                    world.addBloodDecal(target.x, target.y, 7);
                    if (target.health <= 0) {
                        target.dead = true;
                        world.addBloodDecal(target.x, target.y, 15);
                        return 'zombie_killed';
                    }
                }
            }
            return null;
        }

        // Return to nearest military checkpoint if drifting too far
        const cp = world.getClosest(world.militaryCheckpoints, this.x, this.y);
        if (cp && dist(this, cp) > 160) {
            moveTowardAngle(this, angleBetween(this, cp), this.speed, world);
            return null;
        }

        this.currentGoal = "Maintaining perimeter watch";
        if (this.rng() < 0.02) this.targetAngle = this.angle + (this.rng() - 0.5) * 1.5;
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.5, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 6. DOCTOR / PARAMEDIC AGENT
// ═══════════════════════════════════════════════════════════════════
class Doctor {
    constructor(x, y, rng) {
        this.id = 'doc_' + Math.random().toString(36).substring(2, 8);
        this.type = 'doctor';
        this.name = "Dr. " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;

        this.health = 90;
        this.maxHealth = 90;
        this.medSupplies = 12;
        this.cureDoses = 4;
        this.speed = 1.35;
        this.healRadius = 45;
        this.healCooldown = 0;
        this.dead = false;
        this.currentGoal = "Triage medical duty";
        this.animTimer = rng() * 10;
    }

    update(world, agents, params) {
        if (this.dead) return null;
        if (this.healCooldown > 0) this.healCooldown--;

        // 1. Flee from nearby zombies
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead && dist(this, a) < 95) {
                this.currentGoal = "Evading zombie threat!";
                moveTowardAngle(this, angleBetween(a, this), this.speed * 1.5, world);
                return null;
            }
        }

        // 2. Scan for injured or infected patients
        let patient = null;
        let minDist = 180;
        for (const a of agents) {
            if (a.type === 'survivor' && !a.dead && !a.turned && (a.infected || a.health < a.maxHealth)) {
                const d = dist(this, a);
                if (d < minDist) {
                    minDist = d;
                    patient = a;
                }
            }
        }

        // 3. Move toward patient & administer medical care
        if (patient) {
            const d = dist(this, patient);
            if (d > 18) {
                this.currentGoal = `Rushing to treat ${patient.name}`;
                moveTowardAngle(this, angleBetween(this, patient), this.speed * 1.2, world);
            } else if (this.healCooldown === 0) {
                this.healCooldown = 35;

                // Administer Cure if infected and available
                if (patient.infected && this.cureDoses > 0 && params.cureEnabled) {
                    this.cureDoses--;
                    patient.infected = false;
                    patient.infectionTimer = 0;
                    patient.health = Math.min(patient.maxHealth, patient.health + 40);
                    this.currentGoal = `Successfully cured ${patient.name}!`;
                    return 'cured';
                }

                // Standard field healing
                if (patient.health < patient.maxHealth && this.medSupplies > 0) {
                    this.medSupplies--;
                    patient.health = Math.min(patient.maxHealth, patient.health + 35);
                    this.currentGoal = `Stabilized ${patient.name}`;
                    return 'healed';
                }
            }
            return null;
        }

        // 4. Restock at nearest hospital if supplies are low
        if (this.medSupplies < 3 && world.hospitals.length > 0) {
            const h = world.getClosest(world.hospitals, this.x, this.y);
            if (h) {
                this.currentGoal = "Restocking medical trauma supplies";
                moveTowardAngle(this, angleBetween(this, h), this.speed, world);
                if (dist(this, h) < 40) {
                    this.medSupplies = 12;
                    this.cureDoses = 4;
                }
                return null;
            }
        }

        // Default: Patrol near medical facility
        this.currentGoal = "Monitoring field triage zone";
        if (this.rng() < 0.03) this.targetAngle = this.angle + (this.rng() - 0.5) * 1.6;
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.7, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 7. FIREFIGHTER AGENT
// ═══════════════════════════════════════════════════════════════════
class Firefighter {
    constructor(x, y, rng) {
        this.id = 'ff_' + Math.random().toString(36).substring(2, 8);
        this.type = 'firefighter';
        this.name = "Firefighter " + LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
        this.x = x;
        this.y = y;
        this.angle = rng() * Math.PI * 2;
        this.rng = rng;

        this.health = 130;
        this.maxHealth = 130;
        this.speed = 1.25;
        this.axeCooldown = 0;
        this.dead = false;
        this.currentGoal = "Clearing debris and controlling hazard zones";
        this.animTimer = rng() * 10;
    }

    update(world, agents, params) {
        if (this.dead) return null;
        if (this.axeCooldown > 0) this.axeCooldown--;

        // Engage close zombies with fire axe
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead && dist(this, a) < 35 && this.axeCooldown === 0) {
                this.axeCooldown = 28;
                a.health -= 55;
                world.addBloodDecal(a.x, a.y, 8);
                if (a.health <= 0) {
                    a.dead = true;
                    return 'zombie_killed';
                }
            }
        }

        if (this.rng() < 0.03) this.targetAngle = this.angle + (this.rng() - 0.5) * 1.5;
        moveTowardAngle(this, this.targetAngle || this.angle, this.speed * 0.7, world);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 8. EMERGENCY VEHICLES (Police Cars, Ambulances, SWAT Trucks)
// ═══════════════════════════════════════════════════════════════════
class Vehicle {
    constructor(x, y, type, rng) {
        this.id = 'veh_' + Math.random().toString(36).substring(2, 8);
        this.isVehicle = true;
        this.type = type; // 'police_car', 'ambulance', 'swat_van'
        this.x = x;
        this.y = y;
        this.angle = 0;
        this.targetAngle = 0;
        this.speed = 0;
        this.maxSpeed = type === 'police_car' ? 3.6 : (type === 'ambulance' ? 3.2 : 2.5);
        this.accel = 0.08;
        this.health = 300;
        this.dead = false;
        this.rng = rng;

        // Emergency Strobe & Siren System
        this.sirenActive = true;
        this.strobePhase = 0;
        this.headlights = true;
        this.dispatched = false;
        this.targetDestination = null;
        this.currentGoal = "On emergency road patrol";
    }

    update(world, agents) {
        if (this.dead) return;
        this.strobePhase = (this.strobePhase + 0.25) % (Math.PI * 2);

        // 1. Vehicle Navigation along Road Network
        // Find path / target intersection if no active goal
        if (!this.targetDestination || dist(this, this.targetDestination) < 40) {
            // Pick a random intersection on the road network
            if (world.roadIntersections.length > 0) {
                const nextIx = world.roadIntersections[Math.floor(this.rng() * world.roadIntersections.length)];
                this.targetDestination = { x: nextIx.x, y: nextIx.y };
            }
        }

        if (this.targetDestination) {
            this.targetAngle = angleBetween(this, this.targetDestination);
        }

        // Smooth steering
        let diff = this.targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * 0.08;

        // Accelerate
        this.speed = Math.min(this.maxSpeed, this.speed + this.accel);

        const nx = this.x + Math.cos(this.angle) * this.speed;
        const ny = this.y + Math.sin(this.angle) * this.speed;

        if (world.isWalkable(nx, ny) || world.isRoad(nx, ny)) {
            this.x = clamp(nx, 20, WORLD_W - 20);
            this.y = clamp(ny, 20, WORLD_H - 20);
        } else {
            // Pick new target if blocked
            this.targetDestination = null;
            this.angle += Math.PI * 0.5;
        }

        // Check roadkill impact with zombies
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead && dist(this, a) < 22) {
                a.health -= 60;
                world.addBloodDecal(a.x, a.y, 10);
                if (a.health <= 0) a.dead = true;
            }
        }
    }
}
