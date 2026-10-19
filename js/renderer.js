/* ═══════════════════════════════════════════════════════════════════
   renderer.js — Professional Canvas Rendering Engine
   High-detail top-down tactical graphics inspired by Infected Zone:
   - Realistic anatomical characters with animated limbs & head bob
   - Detailed emergency vehicles with flashing lightbars & headlights
   - Authentic urban textures: asphalt, sidewalks, HVAC roofs, trees
   - Dynamic lighting engine (ambient darkness, headlights, streetlamps)
   - Particle systems: muzzle flashes, smoke plumes, fire embers, blood
   - Smooth camera pan & zoom controls
   ═══════════════════════════════════════════════════════════════════ */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // Camera Pan & Zoom System
        this.zoom = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.targetPanX = 0;
        this.targetPanY = 0;
        this.selectedEntity = null;
        this.followSelected = false;

        // Visual Options
        this.nightMode = true; // Dark gritty survival lighting
        this.showRadii = false; // Toggle detection circles

        // Particles
        this.particles = [];

        this._resize();
    }

    _resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth || 1200;
        this.canvas.height = container.clientHeight || 750;
    }

    render(sim) {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);

        // Smooth camera follow on selected entity
        if (this.followSelected && this.selectedEntity && !this.selectedEntity.dead) {
            this.targetPanX = w / 2 - this.selectedEntity.x * this.zoom;
            this.targetPanY = h / 2 - this.selectedEntity.y * this.zoom;
        }

        // Camera interpolation
        this.panX += (this.targetPanX - this.panX) * 0.15;
        this.panY += (this.targetPanY - this.panY) * 0.15;

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.zoom, this.zoom);

        // 1. Draw Ground Infrastructure (Roads, Sidewalks, Markings)
        this._drawGround(ctx, sim.world);

        // 2. Draw Permanent Ground Decals (Blood splatters & skid marks)
        this._drawDecals(ctx, sim.world);

        // 3. Draw Buildings, Rooftop Details & Compounds
        this._drawBuildings(ctx, sim.world, sim.tick);

        // 4. Draw Abandoned / Parked Civilian Vehicles
        this._drawAbandonedCars(ctx, sim.world, sim.tick);

        // 5. Draw Environmental Props (Dumpsters, Sandbags, Fire Barrels)
        this._drawProps(ctx, sim.world, sim.tick);

        // 6. Draw Emergency & Military Vehicles
        this._drawVehicles(ctx, sim.agents, sim.tick);

        // 7. Draw Characters (Dead bodies on ground, then Living agents)
        this._drawCharacters(ctx, sim.agents, sim.tick);

        // 8. Draw Gnarled Trees & High Foliage (Above agents, casting shadows)
        this._drawTrees(ctx, sim.world);

        // 9. Update & Draw Dynamic Particle FX (Smoke, Fire Embers, Muzzle Flashes)
        this._updateAndDrawParticles(ctx, sim.tick);

        // 10. Dynamic Lighting Shroud (Night / Twilight survival atmosphere)
        if (this.nightMode) {
            this._drawDynamicLighting(ctx, sim);
        }

        // 11. Tactical Selection Reticle & Waypoint Lines
        this._drawSelectionHUD(ctx);

        ctx.restore();
    }

    // ═══════════════════════════════════════════════════════════════════
    // GROUND & ROAD TEXTURING
    // ═══════════════════════════════════════════════════════════════════
    _drawGround(ctx, world) {
        // Base Sidewalk Ground
        ctx.fillStyle = '#1c222d';
        ctx.fillRect(0, 0, WORLD_W, WORLD_H);

        // Draw Asphalt Roads with borders
        ctx.fillStyle = '#141820'; // Dark asphalt
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (world.grid[r][c] === T.ROAD) {
                    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
                }
            }
        }

        // Road Lane Stripes & Markings
        ctx.lineWidth = 1.5;
        for (const seg of world.roadSegments) {
            if (seg.type === 'horiz') {
                // Double Yellow Centerline
                ctx.strokeStyle = '#ca8a04';
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y - 1.5);
                ctx.lineTo(seg.x2, seg.y - 1.5);
                ctx.moveTo(seg.x1, seg.y + 1.5);
                ctx.lineTo(seg.x2, seg.y + 1.5);
                ctx.stroke();

                // White Dashed Lane Dividers
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.setLineDash([8, 12]);
                ctx.beginPath();
                ctx.moveTo(seg.x1, seg.y - seg.width * 0.28);
                ctx.lineTo(seg.x2, seg.y - seg.width * 0.28);
                ctx.moveTo(seg.x1, seg.y + seg.width * 0.28);
                ctx.lineTo(seg.x2, seg.y + seg.width * 0.28);
                ctx.stroke();
                ctx.setLineDash([]);
            } else if (seg.type === 'vert') {
                // Double Yellow Centerline
                ctx.strokeStyle = '#ca8a04';
                ctx.beginPath();
                ctx.moveTo(seg.x - 1.5, seg.y1);
                ctx.lineTo(seg.x - 1.5, seg.y2);
                ctx.moveTo(seg.x + 1.5, seg.y1);
                ctx.lineTo(seg.x + 1.5, seg.y2);
                ctx.stroke();

                // White Dashed Lane Dividers
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.setLineDash([8, 12]);
                ctx.beginPath();
                ctx.moveTo(seg.x - seg.width * 0.28, seg.y1);
                ctx.lineTo(seg.x - seg.width * 0.28, seg.y2);
                ctx.moveTo(seg.x + seg.width * 0.28, seg.y1);
                ctx.lineTo(seg.x + seg.width * 0.28, seg.y2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Crosswalk Zebra Stripes at Intersections
        ctx.fillStyle = 'rgba(240, 240, 240, 0.4)';
        for (const ix of world.roadIntersections) {
            const b = ix.bounds;
            // North Crosswalk
            for (let x = b.left + 4; x < b.right - 4; x += 10) {
                ctx.fillRect(x, b.top - 8, 6, 8);
            }
            // South Crosswalk
            for (let x = b.left + 4; x < b.right - 4; x += 10) {
                ctx.fillRect(x, b.bottom, 6, 8);
            }
        }
    }

    _drawDecals(ctx, world) {
        // Permanent Blood Splatters
        for (const d of world.bloodDecals) {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.rotate(d.rotation);
            ctx.fillStyle = d.color;
            ctx.beginPath();
            ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
            ctx.fill();

            for (const sp of d.splatters) {
                ctx.beginPath();
                ctx.arc(sp.dx, sp.dy, sp.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // BUILDINGS & ROOFTOP DETAILS
    // ═══════════════════════════════════════════════════════════════════
    _drawBuildings(ctx, world, tick) {
        // Drop Shadows for All Buildings (South-East displacement)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        for (const b of world.buildings) {
            ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);
        }

        // 1. Standard Commercial & Residential Buildings
        for (const b of world.buildings) {
            // Main Roof Slab
            ctx.fillStyle = b.roofColor;
            ctx.fillRect(b.x, b.y, b.w, b.h);

            // Parapet Border (Inner lip shadow)
            ctx.strokeStyle = '#3e495c';
            ctx.lineWidth = 2;
            ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);

            // Rooftop HVAC Industrial Units with spinning fans
            for (const ac of b.acUnits) {
                ctx.fillStyle = '#475569';
                ctx.fillRect(b.x + ac.rx, b.y + ac.ry, 14, 14);
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(b.x + ac.rx + 7, b.y + ac.ry + 7, 5, 0, Math.PI * 2);
                ctx.fill();

                // Spinning fan blade
                ctx.strokeStyle = '#94a3b8';
                ctx.lineWidth = 1.2;
                const fanAngle = tick * 0.15;
                ctx.beginPath();
                ctx.moveTo(b.x + ac.rx + 7 - Math.cos(fanAngle) * 4, b.y + ac.ry + 7 - Math.sin(fanAngle) * 4);
                ctx.lineTo(b.x + ac.rx + 7 + Math.cos(fanAngle) * 4, b.y + ac.ry + 7 + Math.sin(fanAngle) * 4);
                ctx.stroke();
            }

            // Building Label (Subtle architectural stencil)
            if (b.w > 60) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.font = '9px "Inter", monospace';
                ctx.fillText(b.label, b.x + 6, b.y + b.h - 6);
            }
        }

        // 2. St. Jude Metropolitan Hospital Complex
        for (const h of world.hospitals) {
            const r = h.rect;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(r.x + 8, r.y + 8, r.w, r.h);

            // Hospital Roof (Medical Blue-Grey)
            ctx.fillStyle = '#1e2d42';
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(r.x, r.y, r.w, r.h);

            // Rooftop Helipad
            const hx = r.x + r.w / 2;
            const hy = r.y + r.h / 2;
            ctx.strokeStyle = '#eab308';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(hx, hy, 26, 0, Math.PI * 2);
            ctx.stroke();

            // Helipad 'H'
            ctx.fillStyle = '#eab308';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('H', hx, hy);

            // Flashing Perimeter Landing Beacons
            const beaconOn = (tick % 40) < 20;
            ctx.fillStyle = beaconOn ? '#22c55e' : '#14532d';
            [-26, 26].forEach(dx => {
                [-26, 26].forEach(dy => {
                    ctx.beginPath();
                    ctx.arc(hx + dx, hy + dy, 3, 0, Math.PI * 2);
                    ctx.fill();
                });
            });

            // Hospital Title
            ctx.fillStyle = '#93c5fd';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText("ST. JUDE MEDICAL - EMERGENCY BAY", r.x + 8, r.y + 14);
        }

        // 3. Metro Police Precinct
        for (const p of world.policeStations) {
            const r = p.rect;
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(r.x + 8, r.y + 8, r.w, r.h);

            ctx.fillStyle = '#172033';
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(r.x, r.y, r.w, r.h);

            // Communication Tower Antenna with red warning strobe
            ctx.fillStyle = '#334155';
            ctx.fillRect(r.x + r.w - 20, r.y + 8, 12, 12);
            const strobeOn = (tick % 60) < 15;
            ctx.fillStyle = strobeOn ? '#ef4444' : '#7f1d1d';
            ctx.beginPath();
            ctx.arc(r.x + r.w - 14, r.y + 14, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#a5b4fc';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("METRO POLICE PRECINCT 4", r.x + 8, r.y + 14);
        }

        // 4. Military Checkpoint Bravo
        for (const m of world.militaryCheckpoints) {
            const r = m.rect;
            ctx.fillStyle = '#262e26'; // Camo green
            ctx.fillRect(r.x, r.y, r.w, r.h);
            ctx.strokeStyle = '#4d7c0f';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(r.x, r.y, r.w, r.h);

            ctx.fillStyle = '#bef264';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("F.O.B. OMEGA - MILITARY ARSENAL", r.x + 8, r.y + 14);
        }

        // 5. Fortified Safe Zone Enclaves
        for (const sz of world.safeZones) {
            const r = sz.rect;
            // Wooden palisade wall / corrugated barricade border
            ctx.fillStyle = 'rgba(6, 95, 70, 0.25)';
            ctx.fillRect(r.x, r.y, r.w, r.h);

            ctx.strokeStyle = '#22c55e';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([8, 4]);
            ctx.strokeRect(r.x, r.y, r.w, r.h);
            ctx.setLineDash([]);

            ctx.fillStyle = '#86efac';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText("CIVILIAN SANCTUARY [SECURED]", r.x + 6, r.y + 14);
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ABANDONED CIVILIAN CARS (TACTICAL COVER)
    // ═══════════════════════════════════════════════════════════════════
    _drawAbandonedCars(ctx, world, tick) {
        for (const c of world.abandonedVehicles) {
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.rotate(c.angle);

            // Car Drop Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(-c.w / 2 + 4, -c.h / 2 + 4, c.w, c.h);

            // Wheels
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-c.w / 2 + 5, -c.h / 2 - 2, 8, 4);
            ctx.fillRect(-c.w / 2 + 5, c.h / 2 - 2, 8, 4);
            ctx.fillRect(c.w / 2 - 13, -c.h / 2 - 2, 8, 4);
            ctx.fillRect(c.w / 2 - 13, c.h / 2 - 2, 8, 4);

            // Vehicle Body
            ctx.fillStyle = c.color;
            ctx.beginPath();
            ctx.roundRect(-c.w / 2, -c.h / 2, c.w, c.h, 4);
            ctx.fill();

            // Windshield and Windows
            ctx.fillStyle = c.wrecked ? '#334155' : '#64748b';
            ctx.fillRect(-c.w / 2 + 10, -c.h / 2 + 2, 8, c.h - 4); // Front windshield
            ctx.fillRect(-c.w / 2 + 20, -c.h / 2 + 2, 12, c.h - 4); // Roof
            ctx.fillStyle = '#475569';
            ctx.fillRect(c.w / 2 - 8, -c.h / 2 + 2, 5, c.h - 4); // Rear window

            // Spiderweb crack on wrecked windshield
            if (c.wrecked) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(-c.w / 2 + 14, 0);
                ctx.lineTo(-c.w / 2 + 11, -3);
                ctx.lineTo(-c.w / 2 + 17, 3);
                ctx.stroke();

                // Smoke plume from engine
                if (c.smoking && tick % 6 === 0) {
                    this.particles.push({
                        x: c.x - Math.cos(c.angle) * 15,
                        y: c.y - Math.sin(c.angle) * 15,
                        vx: (Math.random() - 0.5) * 0.4,
                        vy: -0.8 - Math.random() * 0.5,
                        size: 4 + Math.random() * 3,
                        alpha: 0.6,
                        color: 'rgba(80, 80, 80,'
                    });
                }
            }

            ctx.restore();
        }
    }

    _drawProps(ctx, world, tick) {
        // Fire Barrels with Animated Flame & Embers
        for (const fb of world.fireBarrels) {
            // Steel 55-gallon Drum
            ctx.fillStyle = '#374151';
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, 6, 0, Math.PI * 2);
            ctx.fill();

            // Flickering Fire Core
            const flameR = 4 + Math.sin(tick * 0.3) * 1.5;
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, flameR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(fb.x, fb.y, flameR * 0.5, 0, Math.PI * 2);
            ctx.fill();

            // Rising Embers
            if (tick % 5 === 0) {
                this.particles.push({
                    x: fb.x + (Math.random() - 0.5) * 6,
                    y: fb.y + (Math.random() - 0.5) * 6,
                    vx: (Math.random() - 0.5) * 0.6,
                    vy: -1.2 - Math.random() * 0.8,
                    size: 2,
                    alpha: 0.9,
                    color: 'rgba(251, 146, 60,'
                });
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DETAILED EMERGENCY VEHICLES
    // ═══════════════════════════════════════════════════════════════════
    _drawVehicles(ctx, agents, tick) {
        for (const a of agents) {
            if (!a.isVehicle || a.dead) continue;

            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(a.angle);

            const w = 48;
            const h = 24;

            // Vehicle Drop Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(-w / 2 + 5, -h / 2 + 5, w, h);

            // 4 Wheels with tire treads
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-w / 2 + 7, -h / 2 - 2, 9, 4);
            ctx.fillRect(-w / 2 + 7, h / 2 - 2, 9, 4);
            ctx.fillRect(w / 2 - 16, -h / 2 - 2, 9, 4);
            ctx.fillRect(w / 2 - 16, h / 2 - 2, 9, 4);

            if (a.type === 'police_car') {
                // Police Interceptor (Black & White LAPD Style)
                ctx.fillStyle = '#0f172a'; // Black hood and trunk
                ctx.beginPath();
                ctx.roundRect(-w / 2, -h / 2, w, h, 4);
                ctx.fill();

                // White Roof & Doors
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(-w / 2 + 13, -h / 2, 22, h);

                // Front Steel Push Bumper (Bullbar)
                ctx.fillStyle = '#334155';
                ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, h - 6);

                // Windshield & Rear Glass
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(w / 2 - 13, -h / 2 + 3, 5, h - 6);
                ctx.fillRect(-w / 2 + 9, -h / 2 + 3, 4, h - 6);

                // Roof Strobe Lightbar (Alternating Red & Blue)
                const strobe = Math.sin(tick * 0.4) > 0;
                ctx.fillStyle = strobe ? '#ef4444' : '#1e3a8a';
                ctx.fillRect(-w / 2 + 21, -h / 2 + 2, 6, 7);
                ctx.fillStyle = strobe ? '#1d4ed8' : '#3b82f6';
                ctx.fillRect(-w / 2 + 21, h / 2 - 9, 6, 7);

                // Police Decal
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 7px sans-serif';
                ctx.fillText("POLICE", -w / 2 + 15, 3);
            } else if (a.type === 'ambulance') {
                // Type III Modular Box Ambulance
                ctx.fillStyle = '#f8fafc'; // Crisp white
                ctx.beginPath();
                ctx.roundRect(-w / 2, -h / 2, w, h, 4);
                ctx.fill();

                // Orange-Red Fluorescent Hazard Striping
                ctx.fillStyle = '#ea580c';
                ctx.fillRect(-w / 2, -h / 2 + 4, w, 4);
                ctx.fillRect(-w / 2, h / 2 - 8, w, 4);

                // Windshield
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(w / 2 - 12, -h / 2 + 3, 5, h - 6);

                // Blue Star of Life Medical Cross on Roof
                ctx.fillStyle = '#0284c7';
                ctx.fillRect(-w / 2 + 15, -h / 2 + 9, 10, 6);
                ctx.fillRect(-w / 2 + 17, -h / 2 + 7, 6, 10);

                // Flashing Ambulance Beacons
                const ambStrobe = (tick % 20) < 10;
                ctx.fillStyle = ambStrobe ? '#ef4444' : '#f59e0b';
                ctx.beginPath();
                ctx.arc(-w / 2 + 4, -h / 2 + 3, 3, 0, Math.PI * 2);
                ctx.arc(-w / 2 + 4, h / 2 - 3, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Headlights casting forward
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(w / 2 - 1, -h / 2 + 2, 2, 4);
            ctx.fillRect(w / 2 - 1, h / 2 - 6, 2, 4);

            ctx.restore();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ANATOMICAL CHARACTERS (SURVIVORS, ZOMBIES, POLICE, SWAT, DOCTORS)
    // ═══════════════════════════════════════════════════════════════════
    _drawCharacters(ctx, agents, tick) {
        // 1. Draw Dead Bodies on the ground first
        for (const a of agents) {
            if (a.dead && !a.isVehicle) {
                ctx.save();
                ctx.translate(a.x, a.y);
                ctx.rotate(a.angle);
                // Fallen corpse
                ctx.fillStyle = '#1c1917';
                ctx.fillRect(-7, -4, 14, 8);
                ctx.fillStyle = a.type === 'zombie' ? '#4d7c0f' : '#e2e8f0';
                ctx.beginPath();
                ctx.arc(-8, 0, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        // 2. Draw Living Characters with Anatomical Animation
        for (const a of agents) {
            if (a.dead || a.turned || a.rescued || a.isVehicle) continue;

            ctx.save();
            ctx.translate(a.x, a.y);
            ctx.rotate(a.angle);

            // Walking / Running Limbs Stride
            const stride = Math.sin(a.animTimer || 0);

            if (a.type === 'survivor') {
                this._drawSurvivorAnatomy(ctx, a, stride, tick);
            } else if (a.type === 'zombie') {
                this._drawZombieAnatomy(ctx, a, stride, tick);
            } else if (a.type === 'police') {
                this._drawPoliceAnatomy(ctx, a, stride, tick);
            } else if (a.type === 'swat') {
                this._drawSWATAnatomy(ctx, a, stride, tick);
            } else if (a.type === 'military') {
                this._drawMilitaryAnatomy(ctx, a, stride, tick);
            } else if (a.type === 'doctor') {
                this._drawDoctorAnatomy(ctx, a, stride, tick);
            } else if (a.type === 'firefighter') {
                this._drawFirefighterAnatomy(ctx, a, stride, tick);
            }

            // Health bar if injured
            if (a.health < a.maxHealth) {
                const bw = 16, bh = 2.5;
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(-bw / 2 - 1, -14, bw + 2, bh + 2);
                const pct = Math.max(0, a.health / a.maxHealth);
                ctx.fillStyle = pct > 0.5 ? '#22c55e' : (pct > 0.25 ? '#eab308' : '#ef4444');
                ctx.fillRect(-bw / 2, -13, bw * pct, bh);
            }

            ctx.restore();
        }
    }

    _drawSurvivorAnatomy(ctx, a, stride, tick) {
        // Legs in Jeans/Pants
        ctx.fillStyle = a.pantsColor;
        ctx.fillRect(-6 + stride * 3, -6, 5, 4); // Left leg
        ctx.fillRect(-6 - stride * 3, 2, 5, 4);  // Right leg

        // Torso in Shirt / Jacket
        ctx.fillStyle = a.clothingColor;
        ctx.beginPath();
        ctx.roundRect(-4, -5, 8, 10, 2);
        ctx.fill();

        // Arms swinging
        ctx.fillStyle = '#fbcfe8'; // Skin tone
        ctx.fillRect(stride * 2, -7, 4, 3);
        ctx.fillRect(-stride * 2, 4, 4, 3);

        // Backpack with straps
        if (a.hasBackpack) {
            ctx.fillStyle = a.backpackColor;
            ctx.fillRect(-8, -4, 4, 8);
        }

        // Head and Hair
        ctx.fillStyle = a.hairColor;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Infection warning aura if infected
        if (a.infected) {
            const pulse = Math.sin(tick * 0.15) * 3;
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(0, 0, 8 + pulse, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    _drawZombieAnatomy(ctx, a, stride, tick) {
        // Rotting / Bloody limbs
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-5 + stride * 2.5, -5, 5, 3.5);
        ctx.fillRect(-5 - stride * 2.5, 1.5, 5, 3.5);

        // Hunched Torso with torn bloodstained clothes
        ctx.fillStyle = a.shirtColor;
        ctx.beginPath();
        ctx.roundRect(-4, -6, 8, 12, 2);
        ctx.fill();

        // Grasping outstretched claws
        ctx.fillStyle = a.skinColor;
        ctx.fillRect(2 + stride, -7, 7, 3);
        ctx.fillRect(2 - stride, 4, 7, 3);

        // Rotting Head
        ctx.fillStyle = a.skinColor;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Blood on mouth
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(2, -1.5, 3, 3);
    }

    _drawPoliceAnatomy(ctx, a, stride, tick) {
        // Navy pants
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-6 + stride * 2.5, -5, 5, 3.5);
        ctx.fillRect(-6 - stride * 2.5, 1.5, 5, 3.5);

        // Tactical Police Vest with POLICE lettering
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.roundRect(-4, -6, 9, 12, 2);
        ctx.fill();

        // Badge
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-1, -3, 2, 3);

        // Arms holding sidearm
        ctx.fillStyle = '#fbcfe8';
        ctx.fillRect(1, -5, 6, 3);
        ctx.fillRect(1, 2, 6, 3);

        // 9mm Pistol
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(6, -1.5, 5, 3);

        // Muzzle Flash Particle Burst
        if (a.muzzleFlash > 0) {
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(13, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(15, 0, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Police Peaked Cap
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawSWATAnatomy(ctx, a, stride, tick) {
        // Matte Black Tactical Uniform
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-5, -5, 5, 3.5);
        ctx.fillRect(-5, 1.5, 5, 3.5);

        // Heavy Body Armor
        ctx.fillStyle = '#18181b';
        ctx.fillRect(-4, -6, 9, 12);

        // Ballistic Riot Shield in front
        ctx.fillStyle = '#27272a';
        ctx.strokeStyle = '#52525b';
        ctx.lineWidth = 1.5;
        ctx.fillRect(5, -8, 4, 16);
        ctx.strokeRect(5, -8, 4, 16);
        // Shield Glass Viewport
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(5, -3, 3, 6);

        // Red Laser Sight Beam
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(9, 0);
        ctx.lineTo(a.engagementRadius || 120, 0);
        ctx.stroke();

        // SWAT Ballistic Helmet
        ctx.fillStyle = '#27272a';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawMilitaryAnatomy(ctx, a, stride, tick) {
        // Camouflage BDU
        ctx.fillStyle = '#365314';
        ctx.fillRect(-5, -5, 5, 3.5);
        ctx.fillRect(-5, 1.5, 5, 3.5);

        ctx.fillStyle = '#4d7c0f';
        ctx.fillRect(-4, -6, 8, 12);

        // M4 Carbine Rifle
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(2, -2, 10, 4);

        if (a.muzzleFlash > 0) {
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(14, 0, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Helmet
        ctx.fillStyle = '#3f6212';
        ctx.beginPath();
        ctx.arc(0, 0, 4.8, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawDoctorAnatomy(ctx, a, stride, tick) {
        // Medical Scrubs / Paramedic Jacket
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-5, -5, 5, 3.5);
        ctx.fillRect(-5, 1.5, 5, 3.5);

        // White Coat / High-Vis Jacket
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(-4, -6, 8, 12, 2);
        ctx.fill();

        // Red Cross Medical Emblem on Back
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-3, -1, 6, 2);
        ctx.fillRect(-1, -3, 2, 6);

        // Medical Jump Kit
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-7, -4, 3, 8);

        // Hair / Surgical Cap
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawFirefighterAnatomy(ctx, a, stride, tick) {
        // High-Vis Turnout Bunker Gear (Yellow with Reflective Lime Stripe)
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(-5, -5, 5, 3.5);
        ctx.fillRect(-5, 1.5, 5, 3.5);

        ctx.fillStyle = '#eab308';
        ctx.fillRect(-4, -6, 8, 12);
        ctx.fillStyle = '#a3e635'; // Reflective striping
        ctx.fillRect(-4, -1, 8, 2);

        // Fire Helmet with neck flap
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // ═══════════════════════════════════════════════════════════════════
    // GNARLED OAK & PINE TREES (FOLIAGE & BRANCH CANOPY)
    // ═══════════════════════════════════════════════════════════════════
    _drawTrees(ctx, world) {
        for (const t of world.trees) {
            // Drop Shadow on pavement
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(t.x + 8, t.y + 8, t.radius, 0, Math.PI * 2);
            ctx.fill();

            // Lush Foliage Canopy
            ctx.fillStyle = t.type === 'pine' ? '#14532d' : '#166534';
            ctx.beginPath();
            ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            ctx.fill();

            // Gnarled Silhouette Twisting Branches (Infected Zone style)
            ctx.strokeStyle = '#052e16';
            ctx.lineWidth = 2.5;
            for (let i = 0; i < 5; i++) {
                const ang = (i / 5) * Math.PI * 2 + t.seed;
                ctx.beginPath();
                ctx.moveTo(t.x, t.y);
                ctx.lineTo(t.x + Math.cos(ang) * (t.radius * 0.8), t.y + Math.sin(ang) * (t.radius * 0.8));
                ctx.stroke();
            }

            // Trunk Center
            ctx.fillStyle = '#451a03';
            ctx.beginPath();
            ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    _updateAndDrawParticles(ctx, tick) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= 0.015;
            p.size += 0.05;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            ctx.fillStyle = p.color + p.alpha + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // DYNAMIC LIGHTING ENGINE (DARK OPS AMBIENT ILLUMINATION)
    // ═══════════════════════════════════════════════════════════════════
    _drawDynamicLighting(ctx, sim) {
        // Create an offscreen lighting canvas to punch light holes
        if (!this.lightCanvas) {
            this.lightCanvas = document.createElement('canvas');
        }
        this.lightCanvas.width = WORLD_W;
        this.lightCanvas.height = WORLD_H;
        const lctx = this.lightCanvas.getContext('2d');

        // Ambient night gloom
        lctx.fillStyle = 'rgba(8, 12, 20, 0.88)'; // Deep tactical night
        lctx.fillRect(0, 0, WORLD_W, WORLD_H);
        lctx.globalCompositeOperation = 'destination-out';

        // 1. Streetlamps Light Cones
        for (const lamp of sim.world.streetlamps) {
            const grad = lctx.createRadialGradient(lamp.x, lamp.y, 10, lamp.x, lamp.y, lamp.radius);
            grad.addColorStop(0, 'rgba(0,0,0,1)');
            grad.addColorStop(0.7, 'rgba(0,0,0,0.5)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            lctx.fillStyle = grad;
            lctx.beginPath();
            lctx.arc(lamp.x, lamp.y, lamp.radius, 0, Math.PI * 2);
            lctx.fill();
        }

        // 2. Fire Barrels Warm Flickering Light
        for (const fb of sim.world.fireBarrels) {
            const r = 70 + Math.sin(sim.tick * 0.25) * 8;
            const grad = lctx.createRadialGradient(fb.x, fb.y, 8, fb.x, fb.y, r);
            grad.addColorStop(0, 'rgba(0,0,0,1)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            lctx.fillStyle = grad;
            lctx.beginPath();
            lctx.arc(fb.x, fb.y, r, 0, Math.PI * 2);
            lctx.fill();
        }

        // 3. Vehicle Headlights & Emergency Strobes
        for (const a of sim.agents) {
            if (a.isVehicle && !a.dead) {
                // Headlight Beam Cone
                const coneDist = 170;
                const coneAngle = 0.55;
                lctx.beginPath();
                lctx.moveTo(a.x, a.y);
                lctx.arc(a.x, a.y, coneDist, a.angle - coneAngle / 2, a.angle + coneAngle / 2);
                lctx.closePath();
                const grad = lctx.createRadialGradient(a.x, a.y, 10, a.x, a.y, coneDist);
                grad.addColorStop(0, 'rgba(0,0,0,0.95)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                lctx.fillStyle = grad;
                lctx.fill();

                // Flashing Lightbar Pulse
                const strobeR = 120 + Math.sin(sim.tick * 0.4) * 20;
                const sGrad = lctx.createRadialGradient(a.x, a.y, 10, a.x, a.y, strobeR);
                sGrad.addColorStop(0, 'rgba(0,0,0,0.8)');
                sGrad.addColorStop(1, 'rgba(0,0,0,0)');
                lctx.fillStyle = sGrad;
                lctx.beginPath();
                lctx.arc(a.x, a.y, strobeR, 0, Math.PI * 2);
                lctx.fill();
            } else if ((a.type === 'police' || a.type === 'swat' || a.type === 'military') && !a.dead) {
                // Tactical Gun Flashlight Beam
                const fDist = 110;
                lctx.beginPath();
                lctx.moveTo(a.x, a.y);
                lctx.arc(a.x, a.y, fDist, a.angle - 0.4, a.angle + 0.4);
                lctx.closePath();
                const grad = lctx.createRadialGradient(a.x, a.y, 5, a.x, a.y, fDist);
                grad.addColorStop(0, 'rgba(0,0,0,0.9)');
                grad.addColorStop(1, 'rgba(0,0,0,0)');
                lctx.fillStyle = grad;
                lctx.fill();
            }
        }

        // Composite the lighting mask on main canvas
        ctx.drawImage(this.lightCanvas, 0, 0);
    }

    // ═══════════════════════════════════════════════════════════════════
    // TACTICAL SELECTION HUD
    // ═══════════════════════════════════════════════════════════════════
    _drawSelectionHUD(ctx) {
        if (!this.selectedEntity || this.selectedEntity.dead) return;
        const e = this.selectedEntity;

        // Animated Rotating Reticle around selected agent
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16, 0, Math.PI * 2);
        ctx.stroke();

        // 4 Corner Brackets
        const sz = 20;
        ctx.strokeStyle = '#0284c7';
        ctx.beginPath();
        // Top-left
        ctx.moveTo(e.x - sz, e.y - sz + 6); ctx.lineTo(e.x - sz, e.y - sz); ctx.lineTo(e.x - sz + 6, e.y - sz);
        // Top-right
        ctx.moveTo(e.x + sz - 6, e.y - sz); ctx.lineTo(e.x + sz, e.y - sz); ctx.lineTo(e.x + sz, e.y - sz + 6);
        // Bottom-left
        ctx.moveTo(e.x - sz, e.y + sz - 6); ctx.lineTo(e.x - sz, e.y + sz); ctx.lineTo(e.x - sz + 6, e.y + sz);
        // Bottom-right
        ctx.moveTo(e.x + sz - 6, e.y + sz); ctx.lineTo(e.x + sz, e.y + sz); ctx.lineTo(e.x + sz, e.y + sz - 6);
        ctx.stroke();
    }
}
