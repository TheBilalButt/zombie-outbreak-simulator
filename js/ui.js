/* ═══════════════════════════════════════════════════════════════════
   ui.js — Mission Dashboard, Tactical Dossier & Analytics Feeds
   ═══════════════════════════════════════════════════════════════════ */

class DashboardUI {
    constructor() {
        this.popChart = null;
        this.compareChart = null;
        this._initPopChart();
    }

    _initPopChart() {
        const canvas = document.getElementById('chart-population');
        if (!canvas) return;
        this.popChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Healthy', data: [], borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                    { label: 'Infected', data: [], borderColor: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                    { label: 'Dead', data: [], borderColor: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                    { label: 'Zombies', data: [], borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 0 },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', font: { size: 9, family: 'Inter' }, boxWidth: 8, padding: 6 } },
                },
                scales: {
                    x: { display: false },
                    y: { display: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 9 } } }
                }
            }
        });
    }

    updateStats(stats) {
        this._setText('stat-healthy', stats.healthy);
        this._setText('stat-infected', stats.infected);
        this._setText('stat-dead', stats.dead);
        this._setText('stat-zombies', stats.zombies);
        this._setText('stat-police', stats.police);
        this._setText('stat-swat', stats.swat || 0);
        this._setText('stat-military', stats.military || 0);
        this._setText('stat-rescued', stats.rescued);
        this._setText('stat-infrate', stats.infectionRate + '%');
        this._setText('stat-survrate', stats.survivalRate + '%');

        const infBar = document.getElementById('bar-infrate');
        const survBar = document.getElementById('bar-survrate');
        if (infBar) infBar.style.width = stats.infectionRate + '%';
        if (survBar) survBar.style.width = stats.survivalRate + '%';

        // Update Header DEFCON Status Badge
        const badge = document.getElementById('quick-status-badge');
        if (badge) {
            if (stats.zombies === 0 && stats.time > 60) {
                badge.textContent = "DEFCON 5: CITY SECURED";
                badge.className = "status-badge ready";
            } else if (stats.infectionRate > 50) {
                badge.textContent = "DEFCON 1: CRITICAL EPIDEMIC";
                badge.className = "status-badge alert";
            } else if (stats.zombies > 15) {
                badge.textContent = "DEFCON 2: ACTIVE BIO-THREAT";
                badge.className = "status-badge alert";
            } else {
                badge.textContent = "DEFCON 3: CONTAINMENT ACTIVE";
                badge.className = "status-badge ready";
            }
        }
    }

    updateDossier(entity) {
        const panel = document.getElementById('inspection-dossier');
        if (!panel) return;

        if (!entity || entity.dead) {
            panel.classList.add('hidden');
            return;
        }

        panel.classList.remove('hidden');

        // Name and Avatar
        const avatar = document.getElementById('dos-avatar');
        const nameEl = document.getElementById('dos-name');
        const roleEl = document.getElementById('dos-role');

        if (entity.isVehicle) {
            avatar.textContent = entity.type === 'police_car' ? '🚓' : '🚑';
            nameEl.textContent = entity.type === 'police_car' ? "Cruiser Interceptor 1" : "Ambulance Unit 4";
            roleEl.textContent = "EMERGENCY VEHICLE";
            roleEl.className = "dossier-badge police";
        } else {
            const icons = { survivor: '🏃', zombie: '🧟', police: '👮', swat: '🛡️', military: '🪖', doctor: '👨‍⚕️', firefighter: '🧑‍🚒' };
            avatar.textContent = icons[entity.type] || '👤';
            nameEl.textContent = entity.name || entity.type.toUpperCase();
            roleEl.textContent = entity.type.toUpperCase();
            roleEl.className = `dossier-badge ${entity.type}`;
        }

        // Health Bar
        const hpPct = Math.max(0, Math.round((entity.health / entity.maxHealth) * 100));
        const hpBar = document.getElementById('dos-hp-bar');
        const hpText = document.getElementById('dos-hp-text');
        if (hpBar) {
            hpBar.style.width = hpPct + '%';
            hpBar.style.background = hpPct > 50 ? '#22c55e' : (hpPct > 25 ? '#eab308' : '#ef4444');
        }
        if (hpText) hpText.textContent = `${Math.round(entity.health)}/${entity.maxHealth}`;

        // Status & Goal
        this._setText('dos-status', entity.state ? entity.state.toUpperCase() : 'ACTIVE');
        this._setText('dos-goal', entity.currentGoal || 'Holding position');

        // Loadout & Inventory
        let gearText = "Standard survival kit";
        if (entity.type === 'police') gearText = `9mm Sidearm (${entity.ammo}/${entity.maxAmmo}), Kevlar Vest`;
        else if (entity.type === 'swat') gearText = `MP5 SMG (${entity.ammo}/${entity.maxAmmo}), Riot Shield`;
        else if (entity.type === 'military') gearText = `M4 Carbine (${entity.ammo}/${entity.maxAmmo}), Camo BDU`;
        else if (entity.type === 'doctor') gearText = `Trauma Kit (${entity.medSupplies}), Cure Doses (${entity.cureDoses})`;
        else if (entity.type === 'firefighter') gearText = `Fire Axe, Nomex Bunker Gear`;
        else if (entity.isVehicle) gearText = `Emergency Strobe Lightbar, PA Siren System`;
        else if (entity.infected) gearText = `Infected Carrier (${Math.max(0, Math.round((entity.infectionDuration - entity.infectionTimer)/60))}s to turn)`;
        this._setText('dos-gear', gearText);
    }

    updateTime(timeStr) {
        this._setText('stat-time', timeStr);
    }

    updateChart(history) {
        if (!this.popChart || history.length === 0) return;
        const maxPoints = 120;
        const recent = history.slice(-maxPoints);
        this.popChart.data.labels = recent.map(h => h.tick);
        this.popChart.data.datasets[0].data = recent.map(h => h.healthy);
        this.popChart.data.datasets[1].data = recent.map(h => h.infected);
        this.popChart.data.datasets[2].data = recent.map(h => h.dead);
        this.popChart.data.datasets[3].data = recent.map(h => h.zombies);
        this.popChart.update('none');
    }

    updateEvents(events) {
        const log = document.getElementById('event-log');
        if (!log) return;
        log.innerHTML = events.slice(0, 18).map(e => {
            const cls = e.type === 'danger' ? 'ev-danger' : e.type === 'good' ? 'ev-good' : e.type === 'warn' ? 'ev-warn' : 'ev-info';
            return `<div class="event-entry"><span class="event-time">${e.time}</span><span class="event-msg ${cls}">${e.msg}</span></div>`;
        }).join('');
    }

    resetChart() {
        if (this.popChart) {
            this.popChart.data.labels = [];
            this.popChart.data.datasets.forEach(ds => ds.data = []);
            this.popChart.update('none');
        }
    }

    // ─── Comparison Mode ───
    showCompareResults(labelA, statsA, labelB, statsB, histA, histB) {
        document.getElementById('compare-results').classList.remove('hidden');
        document.getElementById('compare-charts').classList.remove('hidden');
        document.getElementById('compare-label-a').textContent = labelA;
        document.getElementById('compare-label-b').textContent = labelB;

        document.getElementById('compare-stats-a').innerHTML = this._renderCompareStats(statsA);
        document.getElementById('compare-stats-b').innerHTML = this._renderCompareStats(statsB);

        this._renderCompareChart(labelA, histA, labelB, histB);
    }

    _renderCompareStats(s) {
        return `
            <div class="compare-stat-row"><span class="cs-label">Healthy Civilians</span><span class="cs-val" style="color:#4ade80">${s.healthy}</span></div>
            <div class="compare-stat-row"><span class="cs-label">Infected Hosts</span><span class="cs-val" style="color:#fbbf24">${s.infected}</span></div>
            <div class="compare-stat-row"><span class="cs-label">Casualties (K.I.A.)</span><span class="cs-val" style="color:#94a3b8">${s.dead}</span></div>
            <div class="compare-stat-row"><span class="cs-label">Active Zombies</span><span class="cs-val" style="color:#ef4444">${s.zombies}</span></div>
            <div class="compare-stat-row"><span class="cs-label">Rescued to Safety</span><span class="cs-val" style="color:#06b6d4">${s.rescued}</span></div>
            <div class="compare-stat-row"><span class="cs-label">Infection Rate</span><span class="cs-val">${s.infectionRate}%</span></div>
            <div class="compare-stat-row"><span class="cs-label">Survival Index</span><span class="cs-val">${s.survivalRate}%</span></div>
        `;
    }

    _renderCompareChart(labelA, histA, labelB, histB) {
        const canvas = document.getElementById('chart-compare');
        if (this.compareChart) this.compareChart.destroy();

        const maxLen = Math.max(histA.length, histB.length);
        const labels = Array.from({ length: maxLen }, (_, i) => i * 10);

        this.compareChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: labelA + ' (Healthy)', data: histA.map(h => h.healthy), borderColor: '#4ade80', borderWidth: 2, pointRadius: 0, tension: 0.3 },
                    { label: labelB + ' (Healthy)', data: histB.map(h => h.healthy), borderColor: '#22d3ee', borderWidth: 2, pointRadius: 0, tension: 0.3, borderDash: [5, 3] },
                    { label: labelA + ' (Zombies)', data: histA.map(h => h.zombies), borderColor: '#ef4444', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
                    { label: labelB + ' (Zombies)', data: histB.map(h => h.zombies), borderColor: '#f97316', borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [5, 3] },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                plugins: {
                    legend: { display: true, position: 'bottom', labels: { color: '#94a3b8', font: { size: 9 }, boxWidth: 10 } },
                },
                scales: {
                    x: { display: true, title: { display: true, text: 'Ticks', color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 8 } } },
                    y: { display: true, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#64748b', font: { size: 9 } } }
                }
            }
        });
    }

    _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
}
