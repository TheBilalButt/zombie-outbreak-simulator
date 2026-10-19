/* ═══════════════════════════════════════════════════════════════════
   renderer.js — Canvas Rendering Engine
   Draws the world grid, all agents with animations, detection radii,
   health bars, and visual effects.
   ═══════════════════════════════════════════════════════════════════ */

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this._resize();
    }

    _resize() {
        const container = this.canvas.parentElement;
        const w = Math.min(WORLD_W, container.clientWidth - 4);
        const h = Math.min(WORLD_H, container.clientHeight - 4);
        const scale = Math.min(w / WORLD_W, h / WORLD_H);
        this.canvas.width = WORLD_W;
        this.canvas.height = WORLD_H;
        this.canvas.style.width = (WORLD_W * scale) + 'px';
        this.canvas.style.height = (WORLD_H * scale) + 'px';
    }

    render(sim) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, WORLD_W, WORLD_H);

        this._drawWorld(ctx, sim.world, sim.tick);
        this._drawAgents(ctx, sim.agents, sim.tick);
    }

    _drawWorld(ctx, world, tick) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const t = world.grid[r][c];
                const x = c * TILE;
                const y = r * TILE;

                // Base color
                ctx.fillStyle = TILE_COLORS[t] || '#181e2a';
                ctx.fillRect(x, y, TILE, TILE);

                // Road line markings
                if (t === T.ROAD) {
                    ctx.fillStyle = '#1a2030';
                    ctx.fillRect(x, y, TILE, TILE);
                    // Subtle grid lines
                    if (c % 3 === 0 && r % 6 === 0) {
                        ctx.fillStyle = '#252e3f';
                        ctx.fillRect(x + TILE/2 - 1, y, 2, TILE);
                    }
                }

                // Building detail
                if (t === T.BUILDING) {
                    ctx.fillStyle = '#394560';
                    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
                    // Windows
                    if ((c + r) % 3 === 0) {
                        ctx.fillStyle = '#4a5568';
                        ctx.fillRect(x + 4, y + 4, 4, 4);
                        ctx.fillRect(x + 12, y + 12, 4, 4);
                    }
                }

                // Park detail — grass texture
                if (t === T.PARK) {
                    if ((c + r) % 2 === 0) {
                        ctx.fillStyle = '#1a6b3a';
                        ctx.fillRect(x + 3, y + 3, 3, 3);
                    }
                }

                // Hospital cross
                if (t === T.HOSPITAL) {
                    ctx.fillStyle = '#2563eb';
                    ctx.fillRect(x + TILE/2 - 1, y + 3, 2, TILE - 6);
                    ctx.fillRect(x + 3, y + TILE/2 - 1, TILE - 6, 2);
                }

                // Police badge
                if (t === T.POLICE) {
                    ctx.fillStyle = '#6366f1';
                    ctx.beginPath();
                    ctx.arc(x + TILE/2, y + TILE/2, 4, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Supply crate
                if (t === T.SUPPLY) {
                    ctx.fillStyle = '#b45309';
                    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
                    ctx.strokeStyle = '#d97706';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 4, y + 4, TILE - 8, TILE - 8);
                }

                // Safe zone glow
                if (t === T.SAFEZONE) {
                    const pulse = 0.15 + Math.sin(tick * 0.03) * 0.05;
                    ctx.fillStyle = `rgba(34, 197, 94, ${pulse})`;
                    ctx.fillRect(x, y, TILE, TILE);
                    ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, y, TILE, TILE);
                }
            }
        }

        // Grid overlay (very subtle)
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * TILE);
            ctx.lineTo(WORLD_W, r * TILE);
            ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * TILE, 0);
            ctx.lineTo(c * TILE, WORLD_H);
            ctx.stroke();
        }
    }

    _drawAgents(ctx, agents, tick) {
        // Draw dead first (below everything)
        for (const a of agents) {
            if (a.type === 'survivor' && a.dead) {
                this._drawDead(ctx, a);
            }
        }

        // Draw living agents
        for (const a of agents) {
            if (a.type === 'survivor' && !a.dead && !a.turned && !a.rescued) {
                this._drawSurvivor(ctx, a, tick);
            }
        }
        for (const a of agents) {
            if (a.type === 'zombie' && !a.dead) {
                this._drawZombie(ctx, a, tick);
            }
        }
        for (const a of agents) {
            if (a.type === 'police' && !a.dead) {
                this._drawPolice(ctx, a, tick);
            }
        }
        for (const a of agents) {
            if (a.type === 'doctor' && !a.dead) {
                this._drawDoctor(ctx, a, tick);
            }
        }
    }

    _drawSurvivor(ctx, a, tick) {
        const size = 5;

        // Detection radius (faint)
        if (a.fear > 30) {
            ctx.beginPath();
            ctx.arc(a.x, a.y, a.detectionRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(251, 191, 36, 0.02)';
            ctx.fill();
        }

        // Body
        const color = a.infected ? '#fbbf24' : '#4ade80';
        const glow = a.infected ? 'rgba(251,191,36,0.3)' : 'rgba(74,222,128,0.15)';

        // Glow
        ctx.beginPath();
        ctx.arc(a.x, a.y, size + 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Agent body
        ctx.beginPath();
        ctx.arc(a.x, a.y, size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Infection pulse
        if (a.infected) {
            const pulse = Math.sin(tick * 0.1) * 3;
            ctx.beginPath();
            ctx.arc(a.x, a.y, size + pulse + 4, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(251,191,36,0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Health bar
        if (a.health < a.maxHealth) {
            const bw = 14, bh = 3;
            const bx = a.x - bw / 2;
            const by = a.y - size - 6;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
            const pct = a.health / a.maxHealth;
            ctx.fillStyle = pct > 0.5 ? '#4ade80' : pct > 0.25 ? '#fbbf24' : '#ef4444';
            ctx.fillRect(bx, by, bw * pct, bh);
        }

        // Safe zone indicator
        if (a.inSafeZone) {
            ctx.beginPath();
            ctx.arc(a.x, a.y, size + 6, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    _drawZombie(ctx, a, tick) {
        const size = 6;

        // Detection radius
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.detectionRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239,68,68,0.03)';
        ctx.fill();

        // Glow
        const glowSize = size + 4 + Math.sin(tick * 0.08) * 2;
        ctx.beginPath();
        ctx.arc(a.x, a.y, glowSize, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239,68,68,0.2)';
        ctx.fill();

        // Body
        ctx.beginPath();
        ctx.arc(a.x, a.y, size, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#7f1d1d';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Eyes
        ctx.fillStyle = '#fef2f2';
        ctx.beginPath();
        ctx.arc(a.x - 2, a.y - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(a.x + 2, a.y - 1, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        const bw = 14, bh = 3;
        const bx = a.x - bw / 2;
        const by = a.y - size - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        const pct = a.health / 100;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bx, by, bw * Math.max(0, pct), bh);
    }

    _drawPolice(ctx, a, tick) {
        const size = 5;

        // Detection radius
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.detectionRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(59,130,246,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Glow
        ctx.beginPath();
        ctx.arc(a.x, a.y, size + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59,130,246,0.2)';
        ctx.fill();

        // Body — shield shape
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - size);
        ctx.lineTo(a.x + size, a.y);
        ctx.lineTo(a.x + size * 0.6, a.y + size * 0.8);
        ctx.lineTo(a.x, a.y + size);
        ctx.lineTo(a.x - size * 0.6, a.y + size * 0.8);
        ctx.lineTo(a.x - size, a.y);
        ctx.closePath();
        ctx.fillStyle = '#3b82f6';
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Ammo indicator
        if (a.ammo <= 3) {
            ctx.fillStyle = '#fbbf24';
            ctx.font = '8px JetBrains Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(a.ammo, a.x, a.y - size - 4);
        }
    }

    _drawDoctor(ctx, a, tick) {
        const size = 5;

        // Glow
        ctx.beginPath();
        ctx.arc(a.x, a.y, size + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(244,114,182,0.15)';
        ctx.fill();

        // Body — diamond shape
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - size);
        ctx.lineTo(a.x + size, a.y);
        ctx.lineTo(a.x, a.y + size);
        ctx.lineTo(a.x - size, a.y);
        ctx.closePath();
        ctx.fillStyle = '#f472b6';
        ctx.fill();
        ctx.strokeStyle = '#be185d';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Cross
        ctx.fillStyle = '#fff';
        ctx.fillRect(a.x - 1, a.y - 3, 2, 6);
        ctx.fillRect(a.x - 3, a.y - 1, 6, 2);
    }

    _drawDead(ctx, a) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#4b5563';
        ctx.fill();
        // X mark
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x - 2, a.y - 2);
        ctx.lineTo(a.x + 2, a.y + 2);
        ctx.moveTo(a.x + 2, a.y - 2);
        ctx.lineTo(a.x - 2, a.y + 2);
        ctx.stroke();
    }
}
