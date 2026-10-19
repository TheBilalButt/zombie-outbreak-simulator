/* ═══════════════════════════════════════════════════════════════════
   app.js — Main Application Entry Point
   Connects Simulation, Canvas Renderer, UI, Presets, and Comparison Mode.
   ═══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    // ─── Initialize Core Components ───
    const canvas = document.getElementById('sim-canvas');
    const renderer = new Renderer(canvas);
    const ui = new DashboardUI();

    // Default configuration from UI inputs
    function getConfigFromInputs() {
        return {
            survivors: parseInt(document.getElementById('slider-survivors').value, 10),
            zombies: parseInt(document.getElementById('slider-zombies').value, 10),
            police: parseInt(document.getElementById('slider-police').value, 10),
            doctors: parseInt(document.getElementById('slider-doctors').value, 10),
            infectionProb: parseFloat(document.getElementById('slider-infection').value),
            zombieSpeed: parseFloat(document.getElementById('slider-zspeed').value),
            resources: parseInt(document.getElementById('slider-resources').value, 10),
            cureEnabled: document.getElementById('chk-cure').checked,
        };
    }

    let sim = new Simulation(getConfigFromInputs(), Date.now() % 100000);

    // Initial render and UI update
    renderer.render(sim);
    ui.updateStats(sim.stats);
    ui.updateTime(sim.getFormattedTime());
    ui.updateEvents(sim.events);

    // ─── DOM References ───
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnStep = document.getElementById('btn-step');
    const btnReset = document.getElementById('btn-reset');
    const sliderSpeed = document.getElementById('slider-speed');
    const valSpeed = document.getElementById('val-speed');
    const overlayStatus = document.getElementById('overlay-status');

    let animationId = null;
    let lastTimestamp = 0;
    let tickAccumulator = 0;

    // ─── Animation Loop ───
    function loop(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = Math.min(100, timestamp - lastTimestamp);
        lastTimestamp = timestamp;

        if (sim.running && !sim.paused) {
            // Base tick rate: 60 ticks/sec at 1.0x speed
            const ticksPerSecond = 60 * sim.speed;
            const msPerTick = 1000 / ticksPerSecond;
            tickAccumulator += delta;

            const maxTicksPerFrame = Math.max(1, Math.ceil(sim.speed * 2));
            let ticksRun = 0;

            while (tickAccumulator >= msPerTick && ticksRun < maxTicksPerFrame) {
                sim.step();
                tickAccumulator -= msPerTick;
                ticksRun++;
            }

            // Sync UI updates periodically
            if (sim.tick % 3 === 0) {
                ui.updateStats(sim.stats);
                ui.updateTime(sim.getFormattedTime());
                ui.updateEvents(sim.events);
            }
            if (sim.tick % 15 === 0) {
                ui.updateChart(sim.history);
            }
            updateStatusOverlay();
        }

        renderer.render(sim);
        animationId = requestAnimationFrame(loop);
    }

    function updateStatusOverlay() {
        if (!overlayStatus) return;
        if (!sim.running) {
            overlayStatus.textContent = 'READY — Configure parameters and click Start';
            overlayStatus.style.borderColor = 'rgba(74, 222, 128, 0.4)';
        } else if (sim.paused) {
            overlayStatus.textContent = `PAUSED (Tick ${sim.tick} — ${sim.getFormattedTime()})`;
            overlayStatus.style.borderColor = 'rgba(251, 191, 36, 0.6)';
        } else if (sim.stats.zombies === 0 && sim.tick > 60) {
            overlayStatus.textContent = 'VICTORY — All zombies eliminated! City secured.';
            overlayStatus.style.borderColor = 'rgba(59, 130, 246, 0.8)';
        } else if (sim.stats.healthy === 0 && sim.stats.infected === 0) {
            overlayStatus.textContent = 'EXTINCTION — No survivors left.';
            overlayStatus.style.borderColor = 'rgba(239, 68, 68, 0.8)';
        } else {
            overlayStatus.textContent = `SIMULATING (${sim.speed.toFixed(1)}x) — Time: ${sim.getFormattedTime()} | Living: ${sim.stats.healthy + sim.stats.infected} | Zombies: ${sim.stats.zombies}`;
            overlayStatus.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        }
    }

    // ─── Playback Controls ───
    btnStart.addEventListener('click', () => {
        if (!sim.running) {
            sim.start();
            btnStart.textContent = '▶ Running';
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnPause.textContent = '⏸ Pause';
        } else if (sim.paused) {
            sim.pause();
            btnPause.textContent = '⏸ Pause';
        }
        updateStatusOverlay();
    });

    btnPause.addEventListener('click', () => {
        if (sim.running) {
            sim.pause();
            btnPause.textContent = sim.paused ? '▶ Resume' : '⏸ Pause';
            updateStatusOverlay();
        }
    });

    btnStep.addEventListener('click', () => {
        if (!sim.running) {
            sim.start();
            sim.pause();
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnPause.textContent = '▶ Resume';
        }
        sim.step();
        ui.updateStats(sim.stats);
        ui.updateTime(sim.getFormattedTime());
        ui.updateEvents(sim.events);
        ui.updateChart(sim.history);
        renderer.render(sim);
        updateStatusOverlay();
    });

    btnReset.addEventListener('click', () => {
        sim.reset(getConfigFromInputs());
        btnStart.textContent = '▶ Start';
        btnStart.disabled = false;
        btnPause.disabled = true;
        btnPause.textContent = '⏸ Pause';
        ui.resetChart();
        ui.updateStats(sim.stats);
        ui.updateTime(sim.getFormattedTime());
        ui.updateEvents(sim.events);
        renderer.render(sim);
        updateStatusOverlay();
    });

    // ─── Speed Slider ───
    sliderSpeed.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        valSpeed.textContent = val.toFixed(1);
        sim.speed = val;
    });

    // ─── Real-Time Parameter Sliders ───
    function bindSlider(sliderId, labelId, configKey, isFloat = false) {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(labelId);
        if (!slider || !label) return;
        slider.addEventListener('input', (e) => {
            const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
            label.textContent = isFloat ? val.toFixed(2) : val;
            if (sim.config[configKey] !== undefined) {
                sim.config[configKey] = val;
            }
        });
    }

    bindSlider('slider-survivors', 'val-survivors', 'survivors');
    bindSlider('slider-zombies', 'val-zombies', 'zombies');
    bindSlider('slider-police', 'val-police', 'police');
    bindSlider('slider-doctors', 'val-doctors', 'doctors');
    bindSlider('slider-infection', 'val-infection', 'infectionProb', true);
    bindSlider('slider-zspeed', 'val-zspeed', 'zombieSpeed', true);
    bindSlider('slider-resources', 'val-resources', 'resources');

    const chkCure = document.getElementById('chk-cure');
    if (chkCure) {
        chkCure.addEventListener('change', (e) => {
            sim.config.cureEnabled = e.target.checked;
        });
    }

    // ─── Presets ───
    const presets = {
        small: {
            survivors: 30, zombies: 3, police: 2, doctors: 1,
            infectionProb: 0.25, zombieSpeed: 1.0, resources: 60, cureEnabled: false
        },
        city: {
            survivors: 120, zombies: 20, police: 8, doctors: 6,
            infectionProb: 0.45, zombieSpeed: 1.4, resources: 40, cureEnabled: false
        },
        strong: {
            survivors: 70, zombies: 12, police: 15, doctors: 8,
            infectionProb: 0.30, zombieSpeed: 1.1, resources: 80, cureEnabled: true
        },
        limited: {
            survivors: 50, zombies: 10, police: 2, doctors: 1,
            infectionProb: 0.40, zombieSpeed: 1.3, resources: 15, cureEnabled: false
        }
    };

    document.querySelectorAll('.preset-grid .btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.preset;
            const p = presets[key];
            if (!p) return;

            document.getElementById('slider-survivors').value = p.survivors;
            document.getElementById('val-survivors').textContent = p.survivors;
            document.getElementById('slider-zombies').value = p.zombies;
            document.getElementById('val-zombies').textContent = p.zombies;
            document.getElementById('slider-police').value = p.police;
            document.getElementById('val-police').textContent = p.police;
            document.getElementById('slider-doctors').value = p.doctors;
            document.getElementById('val-doctors').textContent = p.doctors;
            document.getElementById('slider-infection').value = p.infectionProb;
            document.getElementById('val-infection').textContent = p.infectionProb.toFixed(2);
            document.getElementById('slider-zspeed').value = p.zombieSpeed;
            document.getElementById('val-zspeed').textContent = p.zombieSpeed.toFixed(1);
            document.getElementById('slider-resources').value = p.resources;
            document.getElementById('val-resources').textContent = p.resources;
            document.getElementById('chk-cure').checked = p.cureEnabled;

            sim.reset(p);
            btnStart.textContent = '▶ Start';
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnPause.textContent = '⏸ Pause';
            ui.resetChart();
            ui.updateStats(sim.stats);
            ui.updateTime(sim.getFormattedTime());
            ui.updateEvents(sim.events);
            renderer.render(sim);
            updateStatusOverlay();
        });
    });

    // ─── Live Add Buttons ───
    document.getElementById('btn-add-survivor').addEventListener('click', () => {
        sim.addSurvivor();
        ui.updateStats(sim.stats);
        ui.updateEvents(sim.events);
        renderer.render(sim);
    });

    document.getElementById('btn-add-zombie').addEventListener('click', () => {
        sim.addZombie();
        ui.updateStats(sim.stats);
        ui.updateEvents(sim.events);
        renderer.render(sim);
    });

    document.getElementById('btn-add-safezone').addEventListener('click', () => {
        sim.addSafeZone();
        ui.updateEvents(sim.events);
        renderer.render(sim);
    });

    // ─── Canvas Click: Interactive Spawning ───
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        if (e.shiftKey) {
            // Shift-click spawns Zombie
            const z = new Zombie(clickX, clickY, createRNG(sim.seed + sim.tick + Math.random() * 9999), sim.config.zombieSpeed);
            sim.agents.push(z);
            sim._addEvent('danger', `Zombie spawned manually at (${Math.round(clickX)}, ${Math.round(clickY)})`);
        } else {
            // Regular click spawns Survivor
            const s = new Survivor(clickX, clickY, createRNG(sim.seed + sim.tick + Math.random() * 9999));
            sim.agents.push(s);
            sim.totalInitialSurvivors++;
            sim._addEvent('info', `Survivor placed at (${Math.round(clickX)}, ${Math.round(clickY)})`);
        }
        sim._calcStats();
        ui.updateStats(sim.stats);
        ui.updateEvents(sim.events);
        renderer.render(sim);
    });

    // ─── Modal Handling: Theory and Comparison ───
    const modalInfo = document.getElementById('modal-info');
    const modalCompare = document.getElementById('modal-compare');
    const btnInfo = document.getElementById('btn-info');
    const btnCompare = document.getElementById('btn-compare');
    const closeInfo = document.getElementById('close-info');
    const closeCompare = document.getElementById('close-compare');

    btnInfo.addEventListener('click', () => modalInfo.classList.remove('hidden'));
    closeInfo.addEventListener('click', () => modalInfo.classList.add('hidden'));

    btnCompare.addEventListener('click', () => modalCompare.classList.remove('hidden'));
    closeCompare.addEventListener('click', () => modalCompare.classList.add('hidden'));

    window.addEventListener('click', (e) => {
        if (e.target === modalInfo) modalInfo.classList.add('hidden');
        if (e.target === modalCompare) modalCompare.classList.add('hidden');
    });

    // ─── Comparison Mode Experiments ───
    const comparePresets = {
        police: {
            titleA: 'Low Police Presence (2 Officers)',
            titleB: 'High Police Presence (14 Officers)',
            cfgA: { survivors: 80, zombies: 10, police: 2, doctors: 2, infectionProb: 0.35, zombieSpeed: 1.2, resources: 50, cureEnabled: false },
            cfgB: { survivors: 80, zombies: 10, police: 14, doctors: 2, infectionProb: 0.35, zombieSpeed: 1.2, resources: 50, cureEnabled: false }
        },
        safezones: {
            titleA: 'Scarce Safe Zones / Supplies',
            titleB: 'Fortified City (Safe Zones & Meds)',
            cfgA: { survivors: 80, zombies: 10, police: 4, doctors: 2, infectionProb: 0.35, zombieSpeed: 1.2, resources: 10, cureEnabled: false },
            cfgB: { survivors: 80, zombies: 10, police: 4, doctors: 6, infectionProb: 0.35, zombieSpeed: 1.2, resources: 90, cureEnabled: true }
        },
        infection: {
            titleA: 'Low Virulence (15% Infection Prob)',
            titleB: 'Hyper-Virulent Strain (75% Infection Prob)',
            cfgA: { survivors: 80, zombies: 8, police: 6, doctors: 4, infectionProb: 0.15, zombieSpeed: 1.1, resources: 50, cureEnabled: false },
            cfgB: { survivors: 80, zombies: 8, police: 6, doctors: 4, infectionProb: 0.75, zombieSpeed: 1.4, resources: 50, cureEnabled: false }
        },
        cure: {
            titleA: 'Cure System Disabled',
            titleB: 'Active Medical Cure Research',
            cfgA: { survivors: 80, zombies: 12, police: 6, doctors: 6, infectionProb: 0.40, zombieSpeed: 1.2, resources: 50, cureEnabled: false },
            cfgB: { survivors: 80, zombies: 12, police: 6, doctors: 6, infectionProb: 0.40, zombieSpeed: 1.2, resources: 75, cureEnabled: true }
        }
    };

    document.querySelectorAll('.compare-presets .btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const expKey = btn.dataset.compare;
            const exp = comparePresets[expKey];
            if (!exp) return;

            const statusEl = document.getElementById('compare-status');
            statusEl.textContent = 'Running parallel ABM simulations (1,500 ticks each)...';

            setTimeout(() => {
                const seedA = 10101;
                const seedB = 10101; // identical seed for clean comparative isolation
                const resultA = runHeadless(exp.cfgA, seedA, 1500);
                const resultB = runHeadless(exp.cfgB, seedB, 1500);

                statusEl.textContent = 'Simulations complete. Showing results side by side:';
                ui.showCompareResults(exp.titleA, resultA.stats, exp.titleB, resultB.stats, resultA.history, resultB.history);
            }, 50);
        });
    });

    // Handle Window Resize
    window.addEventListener('resize', () => {
        renderer._resize();
        renderer.render(sim);
    });

    // Start rendering loop
    animationId = requestAnimationFrame(loop);
});
