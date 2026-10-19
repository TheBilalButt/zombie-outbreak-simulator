/* ═══════════════════════════════════════════════════════════════════
   world.js — Detailed Urban Environment Engine
   Generates a gritty, realistic city with multi-lane roads, sidewalks,
   crosswalks, parking lots, hospital with helipad, police precinct,
   military checkpoint, fortified safe zones, gnarled trees, streetlamps,
   fire barrels, dumpsters, and parked/crashed vehicles.
   ═══════════════════════════════════════════════════════════════════ */

const WORLD_W = 1600;
const WORLD_H = 1000;
const TILE = 25; // 25px grid tiles
const COLS = Math.floor(WORLD_W / TILE); // 64 cols
const ROWS = Math.floor(WORLD_H / TILE); // 40 rows

// Tile types
const T = {
    ROAD: 0,
    SIDEWALK: 1,
    BUILDING: 2,
    PARK: 3,
    HOSPITAL: 4,
    POLICE: 5,
    MILITARY: 6,
    SAFEZONE: 7,
    SUPPLY: 8,
    WATER: 9,
};

class World {
    constructor() {
        this.grid = [];
        this.buildings = [];
        this.hospitals = [];
        this.policeStations = [];
        this.militaryCheckpoints = [];
        this.supplyDepots = [];
        this.safeZones = [];
        this.parks = [];
        this.trees = [];
        this.streetlamps = [];
        this.fireBarrels = [];
        this.props = [];
        this.abandonedVehicles = [];
        this.roadIntersections = [];
        this.roadSegments = [];
        this.bloodDecals = []; // Permanent blood splatters
        this.skidMarks = [];

        this.generate();
    }

    generate() {
        // Initialize grid: default to sidewalk
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(T.SIDEWALK));

        // 1. Establish Primary Multi-lane Road Network
        this._buildRoadNetwork();

        // 2. Place Specialized Facility Compounds
        this._buildHospitalCompound();
        this._buildPolicePrecinct();
        this._buildMilitaryCheckpoint();
        this._buildSafeZoneEnclaves();
        this._buildSupplyDepots();
        this._buildCityParks();

        // 3. Place Dense Residential & Commercial City Blocks
        this._buildCityBlocks();

        // 4. Generate Environmental Props & Props Details
        this._populateEnvironment();
    }

    _buildRoadNetwork() {
        // Major Horizontal Avenues (each 3 tiles = 75px wide)
        const horizAvenues = [
            { y: 6, h: 3 },   // North Avenue
            { y: 19, h: 3 },  // Central Boulevard
            { y: 32, h: 3 }   // South Parkway
        ];

        // Major Vertical Streets (each 3 tiles = 75px wide)
        const vertStreets = [
            { x: 8, w: 3 },   // West Street
            { x: 23, w: 3 },  // Commercial Way
            { x: 39, w: 3 },  // 4th Street
            { x: 53, w: 3 }   // East Ring Road
        ];

        // Secondary cross streets (2 tiles = 50px wide)
        const secondaryHoriz = [{ y: 12, h: 2 }, { y: 26, h: 2 }];
        const secondaryVert = [{ x: 15, w: 2 }, { x: 31, w: 2 }, { x: 46, w: 2 }];

        // Fill horizontal roads
        horizAvenues.concat(secondaryHoriz).forEach(road => {
            for (let r = road.y; r < road.y + road.h; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (r >= 0 && r < ROWS) this.grid[r][c] = T.ROAD;
                }
            }
            this.roadSegments.push({ type: 'horiz', y: (road.y + road.h / 2) * TILE, x1: 0, x2: WORLD_W, width: road.h * TILE });
        });

        // Fill vertical roads
        vertStreets.concat(secondaryVert).forEach(road => {
            for (let c = road.x; c < road.x + road.w; c++) {
                for (let r = 0; r < ROWS; r++) {
                    if (c >= 0 && c < COLS) this.grid[r][c] = T.ROAD;
                }
            }
            this.roadSegments.push({ type: 'vert', x: (road.x + road.w / 2) * TILE, y1: 0, y2: WORLD_H, width: road.w * TILE });
        });

        // Find and store Intersections for vehicle navigation and zebra crosswalks
        horizAvenues.concat(secondaryHoriz).forEach(hr => {
            vertStreets.concat(secondaryVert).forEach(vr => {
                const ix = (vr.x + vr.w / 2) * TILE;
                const iy = (hr.y + hr.h / 2) * TILE;
                this.roadIntersections.push({
                    x: ix,
                    y: iy,
                    bounds: {
                        left: vr.x * TILE,
                        right: (vr.x + vr.w) * TILE,
                        top: hr.y * TILE,
                        bottom: (hr.y + hr.h) * TILE
                    }
                });
            });
        });
    }

    _buildHospitalCompound() {
        // Northwest Medical Complex (Hospital with ER bay and rooftop Helipad)
        const x = 1, y = 1, w = 6, h = 4;
        this._fillTileRect(x, y, w, h, T.HOSPITAL);
        const center = { x: (x + w / 2) * TILE, y: (y + h / 2) * TILE };
        this.hospitals.push({
            name: "St. Jude Metropolitan Hospital",
            x: center.x,
            y: center.y,
            rect: { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE },
            helipad: { x: (x + 2) * TILE, y: (y + 2) * TILE },
            erBay: { x: (x + w) * TILE + 10, y: (y + h / 2) * TILE },
            capacity: 50,
            supplies: 100
        });

        // Designated Ambulance Parking Bay
        this.props.push({
            type: 'parking_bay',
            label: 'AMBULANCE ONLY',
            x: (x + w) * TILE + 20,
            y: (y + 1) * TILE,
            w: 40,
            h: 70
        });
    }

    _buildPolicePrecinct() {
        // Central-North Police Compound
        const x = 27, y = 1, w = 5, h = 4;
        this._fillTileRect(x, y, w, h, T.POLICE);
        const center = { x: (x + w / 2) * TILE, y: (y + h / 2) * TILE };
        this.policeStations.push({
            name: "Metro 4th Precinct & SWAT Motorpool",
            x: center.x,
            y: center.y,
            rect: { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE },
            motorPool: { x: (x + w / 2) * TILE, y: (y + h) * TILE + 15 },
            ammoStock: 250
        });

        // Police parking slots with 'P' markings
        for (let i = 0; i < 3; i++) {
            this.props.push({
                type: 'parking_bay',
                label: 'P',
                x: (x + i * 1.5) * TILE,
                y: (y + h) * TILE + 10,
                w: 32,
                h: 55
            });
        }
    }

    _buildMilitaryCheckpoint() {
        // Eastern Highway Military Checkpoint Bravo
        const x = 57, y = 14, w = 6, h = 4;
        this._fillTileRect(x, y, w, h, T.MILITARY);
        const center = { x: (x + w / 2) * TILE, y: (y + h / 2) * TILE };
        this.militaryCheckpoints.push({
            name: "Forward Operating Base 'Omega'",
            x: center.x,
            y: center.y,
            rect: { x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE },
            gunBunkers: [
                { x: x * TILE - 15, y: (y + 1) * TILE },
                { x: x * TILE - 15, y: (y + 3) * TILE }
            ],
            fortified: true
        });

        // Sandbag Barricades across nearby road
        this.props.push({ type: 'sandbags', x: 55 * TILE, y: 19 * TILE + 10, w: 20, h: 50 });
        this.props.push({ type: 'barbed_wire', x: 55 * TILE - 25, y: 19 * TILE + 20, w: 15, h: 40 });
        this.props.push({ type: 'searchlight', x: 56 * TILE, y: 18 * TILE });
    }

    _buildSafeZoneEnclaves() {
        // Southwest Fortified Civilian Sanctuary
        const sz1 = { x: 1, y: 35, w: 6, h: 4 };
        this._fillTileRect(sz1.x, sz1.y, sz1.w, sz1.h, T.SAFEZONE);
        this.safeZones.push({
            name: "Westside Community Sanctuary",
            x: (sz1.x + sz1.w / 2) * TILE,
            y: (sz1.y + sz1.h / 2) * TILE,
            rect: { x: sz1.x * TILE, y: sz1.y * TILE, w: sz1.w * TILE, h: sz1.h * TILE },
            capacity: 80,
            survivorCount: 0,
            gates: [{ x: (sz1.x + sz1.w) * TILE, y: (sz1.y + sz1.h / 2) * TILE }]
        });

        // Northeast Enclave (School Gym Shelter)
        const sz2 = { x: 42, y: 1, w: 6, h: 4 };
        this._fillTileRect(sz2.x, sz2.y, sz2.w, sz2.h, T.SAFEZONE);
        this.safeZones.push({
            name: "Highland Heights Enclave",
            x: (sz2.x + sz2.w / 2) * TILE,
            y: (sz2.y + sz2.h / 2) * TILE,
            rect: { x: sz2.x * TILE, y: sz2.y * TILE, w: sz2.w * TILE, h: sz2.h * TILE },
            capacity: 65,
            survivorCount: 0,
            gates: [{ x: (sz2.x + sz2.w / 2) * TILE, y: (sz2.y + sz2.h) * TILE }]
        });

        // Safe zone campfire / barrel inside
        this.fireBarrels.push({ x: (sz1.x + 2) * TILE, y: (sz1.y + 2) * TILE });
        this.fireBarrels.push({ x: (sz2.x + 3) * TILE, y: (sz2.y + 2) * TILE });
    }

    _buildSupplyDepots() {
        const depots = [
            { x: 18, y: 9, w: 4, h: 2, name: "Downtown Supermarket & Pharmacy" },
            { x: 34, y: 22, w: 4, h: 3, name: "Industrial Warehouse Depot" },
            { x: 11, y: 34, w: 3, h: 3, name: "Gas Station & Convenience Store" }
        ];

        depots.forEach(d => {
            this._fillTileRect(d.x, d.y, d.w, d.h, T.SUPPLY);
            this.supplyDepots.push({
                name: d.name,
                x: (d.x + d.w / 2) * TILE,
                y: (d.y + d.h / 2) * TILE,
                rect: { x: d.x * TILE, y: d.y * TILE, w: d.w * TILE, h: d.h * TILE },
                stock: 100
            });
        });
    }

    _buildCityParks() {
        const parks = [
            { x: 18, y: 14, w: 4, h: 4, name: "Memorial Square Park" },
            { x: 34, y: 27, w: 4, h: 4, name: "Pine Grove Common" }
        ];

        parks.forEach(p => {
            this._fillTileRect(p.x, p.y, p.w, p.h, T.PARK);
            this.parks.push(p);

            // Plant dense trees in park with pine and oak canopy
            for (let i = 0; i < 6; i++) {
                this.trees.push({
                    x: (p.x + 0.5 + Math.random() * (p.w - 1)) * TILE,
                    y: (p.y + 0.5 + Math.random() * (p.h - 1)) * TILE,
                    radius: 18 + Math.random() * 12,
                    type: Math.random() > 0.5 ? 'pine' : 'oak',
                    seed: Math.random() * 1000
                });
            }
        });
    }

    _buildCityBlocks() {
        // Procedural commercial, apartment, and office building blocks
        const blocks = [
            // Sector 1: Northwest Block
            { x: 2, y: 9, w: 5, h: 2, label: "Retail Plaza" },
            { x: 2, y: 14, w: 5, h: 4, label: "Apartments Block A" },
            // Sector 2: North-Central Block
            { x: 12, y: 1, w: 2, h: 4, label: "Offices" },
            { x: 18, y: 1, w: 4, h: 4, label: "Bank & Financial" },
            // Sector 3: Northeast Block
            { x: 35, y: 1, w: 3, h: 4, label: "Tech Hub" },
            { x: 49, y: 1, w: 3, h: 4, label: "Condos" },
            // Sector 4: Central East Block
            { x: 27, y: 9, w: 3, h: 2, label: "Hardware Store" },
            { x: 35, y: 9, w: 3, h: 2, label: "Hotel Victoria" },
            { x: 42, y: 9, w: 3, h: 2, label: "Medical Clinic" },
            { x: 49, y: 9, w: 3, h: 2, label: "Plaza" },
            // Sector 5: Central Block
            { x: 27, y: 14, w: 3, h: 4, label: "City Hall Annex" },
            { x: 35, y: 14, w: 3, h: 4, label: "Tower Block 1" },
            { x: 42, y: 14, w: 3, h: 4, label: "Tower Block 2" },
            { x: 49, y: 14, w: 3, h: 4, label: "Tower Block 3" },
            // Sector 6: Southwest Commercial
            { x: 2, y: 22, w: 5, h: 3, label: "Shopping Mall" },
            { x: 2, y: 28, w: 5, h: 3, label: "Apartments Block B" },
            // Sector 7: South Central Block
            { x: 12, y: 22, w: 2, h: 3, label: "Storage Units" },
            { x: 18, y: 22, w: 4, h: 3, label: "High School" },
            { x: 12, y: 28, w: 2, h: 3, label: "Residential" },
            { x: 18, y: 28, w: 4, h: 3, label: "Civic Center" },
            { x: 27, y: 22, w: 3, h: 3, label: "Warehouse A" },
            { x: 27, y: 28, w: 3, h: 3, label: "Warehouse B" },
            // Sector 8: Southeast Industrial
            { x: 42, y: 22, w: 3, h: 3, label: "Power Substation" },
            { x: 49, y: 22, w: 3, h: 3, label: "Distribution Hub" },
            { x: 42, y: 28, w: 3, h: 3, label: "Manufacturing" },
            { x: 49, y: 28, w: 3, h: 3, label: "Cold Storage" },
            // Sector 9: Southern Perimeter
            { x: 18, y: 36, w: 4, h: 3, label: "Fire Station 7" },
            { x: 27, y: 36, w: 3, h: 3, label: "Depot" },
            { x: 34, y: 36, w: 4, h: 3, label: "Recycling Plant" },
            { x: 42, y: 36, w: 3, h: 3, label: "Water Works" },
            { x: 49, y: 36, w: 3, h: 3, label: "Maintenance" }
        ];

        blocks.forEach(b => {
            this._fillTileRect(b.x, b.y, b.w, b.h, T.BUILDING);
            this.buildings.push({
                x: b.x * TILE,
                y: b.y * TILE,
                w: b.w * TILE,
                h: b.h * TILE,
                label: b.label,
                roofColor: (b.x + b.y) % 2 === 0 ? '#2a313d' : '#222834',
                acUnits: [
                    { rx: 8, ry: 8 },
                    { rx: b.w * TILE - 20, ry: b.h * TILE - 20 }
                ],
                brokenWindows: Math.random() > 0.4
            });
        });
    }

    _populateEnvironment() {
        // 1. Streetlamps along main roads (cast warm light circles)
        const lampInterval = 120;
        for (let x = 60; x < WORLD_W - 60; x += lampInterval) {
            this.streetlamps.push({ x: x, y: 6 * TILE - 10, radius: 85, color: 'rgba(254, 240, 138, 0.28)' });
            this.streetlamps.push({ x: x, y: 9 * TILE + 10, radius: 85, color: 'rgba(254, 240, 138, 0.28)' });
            this.streetlamps.push({ x: x, y: 19 * TILE - 10, radius: 95, color: 'rgba(254, 240, 138, 0.32)' });
            this.streetlamps.push({ x: x, y: 22 * TILE + 10, radius: 95, color: 'rgba(254, 240, 138, 0.32)' });
            this.streetlamps.push({ x: x, y: 32 * TILE - 10, radius: 85, color: 'rgba(254, 240, 138, 0.28)' });
        }

        // 2. Roadside Gnarled Oak and Pine Trees (Inspired by Infected Zone)
        const treeSpots = [
            { x: 160, y: 80 }, { x: 380, y: 80 }, { x: 860, y: 80 }, { x: 1240, y: 80 },
            { x: 160, y: 440 }, { x: 540, y: 440 }, { x: 920, y: 440 }, { x: 1300, y: 440 },
            { x: 160, y: 760 }, { x: 620, y: 760 }, { x: 1060, y: 760 }, { x: 1420, y: 760 },
            { x: 80, y: 260 }, { x: 80, y: 620 }, { x: 740, y: 260 }, { x: 1120, y: 620 }
        ];
        treeSpots.forEach(pt => {
            this.trees.push({
                x: pt.x + (Math.random() - 0.5) * 20,
                y: pt.y + (Math.random() - 0.5) * 20,
                radius: 20 + Math.random() * 8,
                type: Math.random() > 0.4 ? 'oak' : 'pine',
                seed: Math.random() * 1000
            });
        });

        // 3. Abandoned / Crashed Civilian Cars on streets (provide tactical cover)
        const carColors = ['#94a3b8', '#dc2626', '#2563eb', '#15803d', '#334155', '#eab308'];
        const carLocations = [
            { x: 280, y: 7 * TILE + 12, angle: 0.15, wrecked: true, color: carColors[1], type: 'sedan' },
            { x: 520, y: 8 * TILE, angle: -0.4, wrecked: false, color: carColors[0], type: 'pickup' },
            { x: 850, y: 7 * TILE + 8, angle: 0.0, wrecked: true, color: carColors[4], type: 'suv' },
            { x: 1200, y: 8 * TILE + 5, angle: 0.8, wrecked: true, color: carColors[2], type: 'sedan' },
            // Central Boulevard
            { x: 340, y: 20 * TILE + 10, angle: -0.2, wrecked: true, color: carColors[5], type: 'sedan' },
            { x: 680, y: 21 * TILE, angle: 0.05, wrecked: false, color: carColors[3], type: 'suv' },
            { x: 980, y: 20 * TILE + 15, angle: 1.1, wrecked: true, color: carColors[0], type: 'pickup' },
            { x: 1350, y: 21 * TILE + 5, angle: -0.7, wrecked: true, color: carColors[1], type: 'sedan' },
            // Vertical streets
            { x: 9 * TILE + 12, y: 380, angle: 1.57, wrecked: false, color: carColors[2], type: 'sedan' },
            { x: 24 * TILE + 12, y: 640, angle: 1.45, wrecked: true, color: carColors[4], type: 'suv' },
            { x: 40 * TILE + 12, y: 350, angle: 1.62, wrecked: false, color: carColors[5], type: 'pickup' }
        ];

        carLocations.forEach(c => {
            this.abandonedVehicles.push({
                x: c.x,
                y: c.y,
                angle: c.angle,
                w: 42,
                h: 22,
                wrecked: c.wrecked,
                color: c.color,
                type: c.type,
                smoking: c.wrecked && Math.random() > 0.5
            });
        });

        // 4. Street Dumpsters, Fire Barrels, and Road Barriers
        this.fireBarrels.push({ x: 360, y: 20 * TILE - 15 });
        this.fireBarrels.push({ x: 1020, y: 7 * TILE - 15 });
        this.fireBarrels.push({ x: 780, y: 33 * TILE + 15 });

        this.props.push({ type: 'dumpster', x: 210, y: 340, w: 28, h: 16 });
        this.props.push({ type: 'dumpster', x: 740, y: 600, w: 28, h: 16 });
        this.props.push({ type: 'dumpster', x: 1180, y: 220, w: 28, h: 16 });

        this.props.push({ type: 'traffic_barrier', x: 24 * TILE, y: 19 * TILE - 5, w: 30, h: 8 });
        this.props.push({ type: 'traffic_barrier', x: 40 * TILE, y: 22 * TILE + 5, w: 30, h: 8 });
    }

    _fillTileRect(cx, cy, w, h, type) {
        for (let r = cy; r < cy + h && r < ROWS; r++) {
            for (let c = cx; c < cx + w && c < COLS; c++) {
                if (r >= 0 && c >= 0) this.grid[r][c] = type;
            }
        }
    }

    // ─── Spatial Query Methods ───
    isWalkable(px, py) {
        if (px < 5 || px >= WORLD_W - 5 || py < 5 || py >= WORLD_H - 5) return false;
        const c = Math.floor(px / TILE);
        const r = Math.floor(py / TILE);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
        const tile = this.grid[r][c];

        // Buildings block foot traffic
        if (tile === T.BUILDING) return false;

        // Abandoned vehicles act as small physical obstacles
        for (const v of this.abandonedVehicles) {
            const dx = Math.abs(px - v.x);
            const dy = Math.abs(py - v.y);
            if (dx < 16 && dy < 12) return false;
        }

        return true;
    }

    isRoad(px, py) {
        const c = Math.floor(px / TILE);
        const r = Math.floor(py / TILE);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
        return this.grid[r][c] === T.ROAD;
    }

    getTileType(px, py) {
        const c = Math.floor(px / TILE);
        const r = Math.floor(py / TILE);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return T.ROAD;
        return this.grid[r][c];
    }

    isInSafeZone(px, py) {
        return this.getTileType(px, py) === T.SAFEZONE;
    }

    isInHospital(px, py) {
        return this.getTileType(px, py) === T.HOSPITAL;
    }

    isInMilitaryZone(px, py) {
        return this.getTileType(px, py) === T.MILITARY;
    }

    getRandomRoadPos(rng) {
        let attempts = 0;
        while (attempts < 500) {
            const x = 20 + rng() * (WORLD_W - 40);
            const y = 20 + rng() * (WORLD_H - 40);
            if (this.isRoad(x, y) && this.isWalkable(x, y)) {
                return { x, y };
            }
            attempts++;
        }
        return { x: WORLD_W / 2, y: WORLD_H / 2 };
    }

    getClosest(arr, px, py) {
        let best = null, bestD = Infinity;
        for (const p of arr) {
            const d = Math.hypot(p.x - px, p.y - py);
            if (d < bestD) { bestD = d; best = p; }
        }
        return best;
    }

    addSafeZone(px, py) {
        const cx = Math.floor(px / TILE);
        const cy = Math.floor(py / TILE);
        this._fillTileRect(cx - 2, cy - 2, 4, 4, T.SAFEZONE);
        this.safeZones.push({
            name: `Field Bastion #${this.safeZones.length + 1}`,
            x: px,
            y: py,
            rect: { x: (cx - 2) * TILE, y: (cy - 2) * TILE, w: 4 * TILE, h: 4 * TILE },
            capacity: 50,
            survivorCount: 0,
            gates: [{ x: px, y: py }]
        });
        this.fireBarrels.push({ x: px, y: py });
    }

    addBloodDecal(x, y, radius = 8) {
        if (this.bloodDecals.length > 300) this.bloodDecals.shift();
        this.bloodDecals.push({
            x,
            y,
            radius,
            color: Math.random() > 0.4 ? 'rgba(127, 29, 29, 0.7)' : 'rgba(90, 15, 15, 0.6)',
            rotation: Math.random() * Math.PI * 2,
            splatters: Array.from({ length: 4 }, () => ({
                dx: (Math.random() - 0.5) * radius * 1.5,
                dy: (Math.random() - 0.5) * radius * 1.5,
                r: 1.5 + Math.random() * 2.5
            }))
        });
    }
}
