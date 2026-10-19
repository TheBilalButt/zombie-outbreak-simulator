/* ═══════════════════════════════════════════════════════════════════
   world.js — City World Generation
   Procedural city with buildings, roads, parks, hospitals, police
   stations, supply depots, and safe zones.
   ═══════════════════════════════════════════════════════════════════ */

const WORLD_W = 1200;
const WORLD_H = 800;
const TILE = 20; // grid tile size
const COLS = WORLD_W / TILE;
const ROWS = WORLD_H / TILE;

// Tile types
const T = {
    ROAD: 0,
    BUILDING: 1,
    PARK: 2,
    HOSPITAL: 3,
    POLICE: 4,
    SUPPLY: 5,
    SAFEZONE: 6,
};

const TILE_COLORS = {
    [T.ROAD]:     '#181e2a',
    [T.BUILDING]: '#2d3548',
    [T.PARK]:     '#14532d',
    [T.HOSPITAL]: '#1e3a5f',
    [T.POLICE]:   '#312e81',
    [T.SUPPLY]:   '#78350f',
    [T.SAFEZONE]: '#065f46',
};

class World {
    constructor() {
        this.grid = [];
        this.buildings = [];
        this.hospitals = [];
        this.policeStations = [];
        this.supplyDepots = [];
        this.safeZones = [];
        this.parks = [];
        this.generate();
    }

    generate() {
        // Initialize all as road
        this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(T.ROAD));
        this.buildings = [];
        this.hospitals = [];
        this.policeStations = [];
        this.supplyDepots = [];
        this.safeZones = [];
        this.parks = [];

        // Place buildings in a city block pattern
        this._placeBlocks();

        // Place special buildings
        this._placeSpecial(T.HOSPITAL,  [{x:3, y:3, w:4, h:3}, {x:50, y:30, w:4, h:3}]);
        this._placeSpecial(T.POLICE,    [{x:28, y:3, w:3, h:3}, {x:45, y:20, w:3, h:3}]);
        this._placeSpecial(T.SUPPLY,    [{x:10, y:30, w:3, h:2}, {x:35, y:8, w:3, h:2}, {x:52, y:15, w:3, h:2}]);
        this._placeSpecial(T.SAFEZONE,  [{x:1, y:35, w:5, h:4}, {x:55, y:1, w:4, h:4}]);

        // Place parks
        this._placePark({x:18, y:18, w:6, h:5});
        this._placePark({x:40, y:28, w:5, h:5});
        this._placePark({x:8, y:12, w:4, h:4});

        // Store locations for agent use
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const t = this.grid[r][c];
                if (t === T.HOSPITAL) this._addUnique(this.hospitals, {x: c*TILE+TILE/2, y: r*TILE+TILE/2});
                if (t === T.POLICE) this._addUnique(this.policeStations, {x: c*TILE+TILE/2, y: r*TILE+TILE/2});
                if (t === T.SUPPLY) this._addUnique(this.supplyDepots, {x: c*TILE+TILE/2, y: r*TILE+TILE/2});
                if (t === T.SAFEZONE) this._addUnique(this.safeZones, {x: c*TILE+TILE/2, y: r*TILE+TILE/2});
            }
        }
    }

    _addUnique(arr, pt) {
        if (!arr.some(p => Math.abs(p.x - pt.x) < TILE*2 && Math.abs(p.y - pt.y) < TILE*2)) {
            arr.push(pt);
        }
    }

    _placeBlocks() {
        // Create city blocks
        const blockPatterns = [
            // Row 1
            {x:6,  y:2,  w:4, h:4},
            {x:12, y:2,  w:3, h:3},
            {x:17, y:2,  w:5, h:4},
            {x:24, y:2,  w:3, h:4},
            {x:33, y:2,  w:4, h:3},
            {x:39, y:2,  w:3, h:4},
            {x:44, y:2,  w:4, h:3},
            {x:50, y:2,  w:3, h:3},
            // Row 2
            {x:3,  y:8,  w:5, h:3},
            {x:14, y:8,  w:3, h:3},
            {x:20, y:8,  w:4, h:3},
            {x:26, y:8,  w:3, h:4},
            {x:31, y:8,  w:3, h:3},
            {x:40, y:8,  w:4, h:3},
            {x:46, y:8,  w:3, h:3},
            {x:52, y:8,  w:4, h:3},
            // Row 3
            {x:2,  y:15, w:4, h:3},
            {x:13, y:15, w:4, h:3},
            {x:25, y:15, w:5, h:3},
            {x:32, y:14, w:3, h:4},
            {x:37, y:15, w:3, h:3},
            {x:42, y:14, w:4, h:3},
            {x:49, y:15, w:4, h:3},
            {x:55, y:14, w:3, h:3},
            // Row 4
            {x:2,  y:22, w:3, h:3},
            {x:7,  y:22, w:4, h:4},
            {x:13, y:23, w:3, h:3},
            {x:19, y:24, w:4, h:3},
            {x:25, y:22, w:3, h:3},
            {x:30, y:23, w:4, h:3},
            {x:36, y:22, w:3, h:3},
            {x:49, y:22, w:4, h:3},
            {x:55, y:22, w:3, h:3},
            // Row 5
            {x:3,  y:30, w:3, h:3},
            {x:15, y:30, w:4, h:3},
            {x:21, y:30, w:3, h:3},
            {x:26, y:30, w:4, h:3},
            {x:32, y:30, w:3, h:3},
            {x:37, y:30, w:3, h:3},
            {x:46, y:30, w:4, h:3},
            {x:52, y:30, w:4, h:3},
            // Row 6
            {x:7,  y:35, w:3, h:3},
            {x:12, y:35, w:4, h:3},
            {x:18, y:36, w:3, h:3},
            {x:23, y:35, w:4, h:3},
            {x:30, y:36, w:3, h:3},
            {x:35, y:35, w:4, h:3},
            {x:41, y:35, w:3, h:3},
            {x:47, y:35, w:4, h:3},
            {x:53, y:36, w:3, h:3},
        ];

        blockPatterns.forEach(b => {
            this._fillRect(b.x, b.y, b.w, b.h, T.BUILDING);
            this.buildings.push(b);
        });
    }

    _placeSpecial(type, locs) {
        locs.forEach(b => {
            this._fillRect(b.x, b.y, b.w, b.h, type);
        });
    }

    _placePark(b) {
        this._fillRect(b.x, b.y, b.w, b.h, T.PARK);
        this.parks.push(b);
    }

    _fillRect(cx, cy, w, h, type) {
        for (let r = cy; r < cy + h && r < ROWS; r++) {
            for (let c = cx; c < cx + w && c < COLS; c++) {
                if (r >= 0 && c >= 0) this.grid[r][c] = type;
            }
        }
    }

    addSafeZone(px, py) {
        const cx = Math.floor(px / TILE);
        const cy = Math.floor(py / TILE);
        this._fillRect(cx - 1, cy - 1, 3, 3, T.SAFEZONE);
        this.safeZones.push({x: px, y: py});
    }

    isWalkable(px, py) {
        const c = Math.floor(px / TILE);
        const r = Math.floor(py / TILE);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
        return this.grid[r][c] !== T.BUILDING;
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

    getRandomRoadPos(rng) {
        let attempts = 0;
        while (attempts < 500) {
            const x = rng() * WORLD_W;
            const y = rng() * WORLD_H;
            if (this.isWalkable(x, y) && this.getTileType(x, y) !== T.BUILDING) {
                return {x, y};
            }
            attempts++;
        }
        return {x: WORLD_W / 2, y: WORLD_H / 2};
    }

    getClosest(arr, px, py) {
        let best = null, bestD = Infinity;
        for (const p of arr) {
            const d = Math.hypot(p.x - px, p.y - py);
            if (d < bestD) { bestD = d; best = p; }
        }
        return best;
    }
}
