/* ═══════════════════════════════════════════════════════════════════
   app.js — Tactical Game Orchestrator & Controls
   Connects Simulation, Renderer, UI Dossier, Camera Pan & Zoom,
   Synthesized Web Audio SFX, and Field Reinforcement Controls.
   ═══════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('sim-canvas');
    const renderer = new Renderer(canvas);
    const ui = new DashboardUI();

    // ─── Procedural Web Audio Sound Engine (No External Audio Files Needed) ───
    class SoundEngine {
        constructor() {
            this.ctx = null;
            this.enabled = true;
        }

        _init() {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            }
        }

        playGunshot() {
            if (!this.enabled) return;
            this._init();
            if (!this.ctx) return;
            const t = this.ctx.currentTime;
            const bufferSize = this.ctx.sampleRate * 0.12;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.02));
            }
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, t);
            filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(t);
        }

        playBite() {
            if (!this.enabled) return;
            this._init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const t = this.ctx.currentTime;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(180, t);
            osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.2);
        }

        playHeal() {
            if (!this.enabled) return;
            this._init();
            if (!this.ctx) return;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const t = this.ctx.currentTime;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, t); // C5
            osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
        }
    }

    const sound = new SoundEngine();

    // ─── Input Configuration ───
    function getConfigFromInputs() {
        return {
            survivors: parseInt(document.getElementById('slider-survivors').value, 10),
            zombies: parseInt(document.getElementById('slider-zombies').value, 10),
            police: parseInt(document.getElementById('slider-police').value, 10),
            swat: parseInt(document.getElementById('slider-swat').value, 10),
            military: parseInt(document.getElementById('slider-military').value, 10),
            doctors: parseInt(document.getElementById('slider-doctors').value, 10),
            infectionProb: parseFloat(document.getElementById('slider-infection').value),
            zombieSpeed: parseFloat(document.getElementById('slider-zspeed').value),
            cureEnabled: document.getElementById('chk-cure').checked,
        };
    }

    let sim = new Simulation(getConfigFromInputs(), Date.now() % 100000);

    // Initial render and telemetry sync
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

    // ─── Main Animation Loop ───
    function loop(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = Math.min(100, timestamp - lastTimestamp);
        lastTimestamp = timestamp;

        if (sim.running && !sim.paused) {
            const ticksPerSecond = 60 * sim.speed;
            const msPerTick = 1000 / ticksPerSecond;
            tickAccumulator += delta;

            const maxTicksPerFrame = Math.max(1, Math.ceil(sim.speed * 2));
            let ticksRun = 0;

            while (tickAccumulator >= msPerTick && ticksRun < maxTicksPerFrame) {
                // Check events for audio triggers
                const prevEventsLen = sim.events.length;
                sim.step();
                if (sim.events.length > prevEventsLen) {
                    const latest = sim.events[0];
                    if (latest.type === 'good' && latest.msg.includes('eliminated')) {
                        sound.playGunshot();
                    } else if (latest.type === 'danger' && latest.msg.includes('infected')) {
                        sound.playBite();
                    } else if (latest.type === 'good' && latest.msg.includes('cure')) {
                        sound.playHeal();
                    }
                }
                tickAccumulator -= msPerTick;
                ticksRun++;
            }

            // Sync UI periodically
            if (sim.tick % 4 === 0) {
                ui.updateStats(sim.stats);
                ui.updateTime(sim.getFormattedTime());
                ui.updateEvents(sim.events);
                if (renderer.selectedEntity) {
                    ui.updateDossier(renderer.selectedEntity);
                }
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
            overlayStatus.textContent = 'DEFCON 5 — Configure tactical quotas and click Start';
        } else if (sim.paused) {
            overlayStatus.textContent = `PAUSED (Tick ${sim.tick} — ${sim.getFormattedTime()})`;
        } else if (sim.stats.zombies === 0 && sim.tick > 60) {
            overlayStatus.textContent = 'VICTORY — Bio-threat eliminated. Urban sector secured!';
        } else if (sim.stats.healthy === 0 && sim.stats.infected === 0) {
            overlayStatus.textContent = 'EXTINCTION — All civilians eliminated or turned.';
        } else {
            overlayStatus.textContent = `ENGAGED (${sim.speed.toFixed(1)}x) — Civilians: ${sim.stats.healthy} | Hostiles: ${sim.stats.zombies} | Containment: ${sim.stats.survivalRate}%`;
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
        renderer.selectedEntity = null;
        ui.updateDossier(null);
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
        valSpeed.textContent = val.toFixed(1) + 'x';
        sim.speed = val;
    });

    // ─── Sliders Binding ───
    function bindSlider(sliderId, labelId, configKey, isFloat = false, suffix = '') {
        const slider = document.getElementById(sliderId);
        const label = document.getElementById(labelId);
        if (!slider || !label) return;
        slider.addEventListener('input', (e) => {
            const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
            label.textContent = (isFloat ? val.toFixed(2) : val) + suffix;
            if (sim.config[configKey] !== undefined) {
                sim.config[configKey] = val;
            }
        });
    }

    bindSlider('slider-survivors', 'val-survivors', 'survivors');
    bindSlider('slider-zombies', 'val-zombies', 'zombies');
    bindSlider('slider-police', 'val-police', 'police');
    bindSlider('slider-swat', 'val-swat', 'swat');
    bindSlider('slider-military', 'val-military', 'military');
    bindSlider('slider-doctors', 'val-doctors', 'doctors');
    bindSlider('slider-infection', 'val-infection', 'infectionProb', true, '%');
    bindSlider('slider-zspeed', 'val-zspeed', 'zombieSpeed', true, 'x');

    const chkCure = document.getElementById('chk-cure');
    if (chkCure) {
        chkCure.addEventListener('change', (e) => {
            sim.config.cureEnabled = e.target.checked;
        });
    }

    // ─── Preset Scenarios ───
    const presets = {
        small: {
            survivors: 40, zombies: 4, police: 4, swat: 2, military: 2, doctors: 2,
            infectionProb: 0.25, zombieSpeed: 1.1, cureEnabled: false
        },
        city: {
            survivors: 140, zombies: 25, police: 8, swat: 4, military: 4, doctors: 6,
            infectionProb: 0.45, zombieSpeed: 1.4, cureEnabled: false
        },
        strong: {
            survivors: 80, zombies: 15, police: 14, swat: 8, military: 10, doctors: 6,
            infectionProb: 0.30, zombieSpeed: 1.2, cureEnabled: true
        },
        limited: {
            survivors: 50, zombies: 12, police: 2, swat: 0, military: 0, doctors: 1,
            infectionProb: 0.40, zombieSpeed: 1.3, cureEnabled: false
        }
    };

    document.querySelectorAll('.preset-grid .btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = presets[btn.dataset.preset];
            if (!p) return;

            document.getElementById('slider-survivors').value = p.survivors;
            document.getElementById('val-survivors').textContent = p.survivors;
            document.getElementById('slider-zombies').value = p.zombies;
            document.getElementById('val-zombies').textContent = p.zombies;
            document.getElementById('slider-police').value = p.police;
            document.getElementById('val-police').textContent = p.police;
            document.getElementById('slider-swat').value = p.swat;
            document.getElementById('val-swat').textContent = p.swat;
            document.getElementById('slider-military').value = p.military;
            document.getElementById('val-military').textContent = p.military;
            document.getElementById('slider-doctors').value = p.doctors;
            document.getElementById('val-doctors').textContent = p.doctors;
            document.getElementById('slider-infection').value = p.infectionProb;
            document.getElementById('val-infection').textContent = Math.round(p.infectionProb * 100) + '%';
            document.getElementById('slider-zspeed').value = p.zombieSpeed;
            document.getElementById('val-zspeed').textContent = p.zombieSpeed.toFixed(1) + 'x';
            document.getElementById('chk-cure').checked = p.cureEnabled;

            sim.reset(p);
            btnStart.textContent = '▶ Start';
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnPause.textContent = '⏸ Pause';
            renderer.selectedEntity = null;
            ui.updateDossier(null);
            ui.resetChart();
            ui.updateStats(sim.stats);
            ui.updateTime(sim.getFormattedTime());
            ui.updateEvents(sim.events);
            renderer.render(sim);
            updateStatusOverlay();
        });
    });

    // ─── Field Deployment Buttons ───
    document.getElementById('btn-add-survivor').addEventListener('click', () => { sim.addSurvivor(); renderer.render(sim); });
    document.getElementById('btn-add-zombie').addEventListener('click', () => { sim.addZombie(); renderer.render(sim); });
    document.getElementById('btn-add-police').addEventListener('click', () => { sim.addPolice(); renderer.render(sim); });
    document.getElementById('btn-add-swat').addEventListener('click', () => { sim.addSWAT(); renderer.render(sim); });
    document.getElementById('btn-add-military').addEventListener('click', () => { sim.addMilitary(); renderer.render(sim); });
    document.getElementById('btn-add-police-car').addEventListener('click', () => { sim.addPoliceCar(); renderer.render(sim); });
    document.getElementById('btn-add-ambulance').addEventListener('click', () => { sim.addAmbulance(); renderer.render(sim); });
    document.getElementById('btn-add-safezone').addEventListener('click', () => { sim.addSafeZone(); renderer.render(sim); });

    // ─── Top Bar Controls (Night Vision, Audio, Modals) ───
    const btnNight = document.getElementById('btn-night');
    btnNight.addEventListener('click', () => {
        renderer.nightMode = !renderer.nightMode;
        btnNight.classList.toggle('active', renderer.nightMode);
        renderer.render(sim);
    });

    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
        sound.enabled = !sound.enabled;
        btnSound.textContent = sound.enabled ? '🔊 SFX: ON' : '🔇 SFX: OFF';
        btnSound.classList.toggle('active', sound.enabled);
    });

    // ─── Camera Pan & Zoom Controls ───
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartX = e.clientX - renderer.targetPanX;
        dragStartY = e.clientY - renderer.targetPanY;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        renderer.followSelected = false;
        document.getElementById('btn-follow-toggle').classList.remove('active');
        renderer.targetPanX = e.clientX - dragStartX;
        renderer.targetPanY = e.clientY - dragStartY;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Smooth Mouse Wheel Zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        const newZoom = clamp(renderer.zoom * zoomFactor, 0.4, 2.5);

        // Zoom relative to mouse cursor
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        renderer.targetPanX = mouseX - (mouseX - renderer.targetPanX) * (newZoom / renderer.zoom);
        renderer.targetPanY = mouseY - (mouseY - renderer.targetPanY) * (newZoom / renderer.zoom);
        renderer.zoom = newZoom;
    }, { passive: false });

    // Floating Camera Buttons
    document.getElementById('btn-zoom-in').addEventListener('click', () => {
        renderer.zoom = clamp(renderer.zoom * 1.25, 0.4, 2.5);
    });

    document.getElementById('btn-zoom-out').addEventListener('click', () => {
        renderer.zoom = clamp(renderer.zoom * 0.8, 0.4, 2.5);
    });

    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
        renderer.zoom = 1.0;
        renderer.targetPanX = 0;
        renderer.targetPanY = 0;
        renderer.followSelected = false;
        document.getElementById('btn-follow-toggle').classList.remove('active');
    });

    const btnFollow = document.getElementById('btn-follow-toggle');
    btnFollow.addEventListener('click', () => {
        if (renderer.selectedEntity) {
            renderer.followSelected = !renderer.followSelected;
            btnFollow.classList.toggle('active', renderer.followSelected);
        }
    });

    // ─── Tactical Entity Selection Click Handler ───
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left - renderer.panX) / renderer.zoom;
        const worldY = (e.clientY - rect.top - renderer.panY) / renderer.zoom;

        // Find nearest agent or vehicle within 25px
        let selected = null;
        let minDist = 26;

        for (const a of sim.agents) {
            const d = Math.hypot(a.x - worldX, a.y - worldY);
            if (d < minDist) {
                minDist = d;
                selected = a;
            }
        }

        renderer.selectedEntity = selected;
        ui.updateDossier(selected);
        renderer.render(sim);
    });

    document.getElementById('dos-close').addEventListener('click', () => {
        renderer.selectedEntity = null;
        ui.updateDossier(null);
        renderer.followSelected = false;
        btnFollow.classList.remove('active');
        renderer.render(sim);
    });

    // ─── Keyboard Hotkeys ───
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            btnPause.click();
        } else if (e.code === 'KeyN') {
            btnNight.click();
        } else if (e.code === 'KeyF') {
            btnFollow.click();
        } else if (e.code === 'KeyR' && e.ctrlKey) {
            // let normal refresh happen
        } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
            renderer.targetPanY += 40;
        } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
            renderer.targetPanY -= 40;
        } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
            renderer.targetPanX += 40;
        } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
            renderer.targetPanX -= 40;
        }
    });

    // ─── Modals Handling (Theory & Comparison) ───
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

    // Comparison Mode Experiments
    const comparePresets = {
        police: {
            titleA: 'Minimal Police (2 Officers)',
            titleB: 'High Tactical Density (14 Police & SWAT)',
            cfgA: { survivors: 80, zombies: 12, police: 2, swat: 0, military: 0, infectionProb: 0.35, zombieSpeed: 1.2 },
            cfgB: { survivors: 80, zombies: 12, police: 10, swat: 4, military: 4, infectionProb: 0.35, zombieSpeed: 1.2 }
        },
        safezones: {
            titleA: 'Open Metropolis (No Safe Sanctuaries)',
            titleB: 'Fortified Sanctuaries with Medical Bay',
            cfgA: { survivors: 80, zombies: 12, police: 4, swat: 2, infectionProb: 0.35, zombieSpeed: 1.2 },
            cfgB: { survivors: 80, zombies: 12, police: 4, swat: 2, doctors: 6, infectionProb: 0.35, zombieSpeed: 1.2 }
        },
        infection: {
            titleA: 'Low Virulence Strain (15% Inoculation)',
            titleB: 'Hyper-Virulent Mutation (75% Inoculation)',
            cfgA: { survivors: 80, zombies: 10, police: 6, swat: 3, infectionProb: 0.15, zombieSpeed: 1.1 },
            cfgB: { survivors: 80, zombies: 10, police: 6, swat: 3, infectionProb: 0.75, zombieSpeed: 1.4 }
        },
        cure: {
            titleA: 'No Medical Cure Developed',
            titleB: 'Active Vaccine Deployment',
            cfgA: { survivors: 80, zombies: 12, police: 6, doctors: 4, infectionProb: 0.40, cureEnabled: false },
            cfgB: { survivors: 80, zombies: 12, police: 6, doctors: 6, infectionProb: 0.40, cureEnabled: true }
        }
    };

    document.querySelectorAll('.compare-presets .btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const exp = comparePresets[btn.dataset.compare];
            if (!exp) return;

            const statusEl = document.getElementById('compare-status');
            statusEl.textContent = 'Executing parallel ABM simulations (1,500 ticks each)...';

            setTimeout(() => {
                const seed = 10101;
                const resultA = runHeadless(exp.cfgA, seed, 1500);
                const resultB = runHeadless(exp.cfgB, seed, 1500);

                statusEl.textContent = 'Simulations complete. Visualizing comparative metrics:';
                ui.showCompareResults(exp.titleA, resultA.stats, exp.titleB, resultB.stats, resultA.history, resultB.history);
            }, 60);
        });
    });

    window.addEventListener('resize', () => {
        renderer._resize();
        renderer.render(sim);
    });

    animationId = requestAnimationFrame(loop);
});
