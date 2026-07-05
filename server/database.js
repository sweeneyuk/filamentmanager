const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'filamentmanager.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create settings table
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )
      `);

      // Create users table for auth
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          is_admin INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create brands table
      db.run(`
        CREATE TABLE IF NOT EXISTS brands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          default_empty_weight REAL
        )
      `);

      // Create materials table
      db.run(`
        CREATE TABLE IF NOT EXISTS materials (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL
        )
      `);

      // Create spools table
      db.run(`
        CREATE TABLE IF NOT EXISTS spools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          brand_id INTEGER,
          material_id INTEGER,
          color TEXT,
          cost REAL,
          total_weight REAL,
          empty_weight REAL,
          used_weight REAL DEFAULT 0,
          shopify_variant_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (brand_id) REFERENCES brands(id),
          FOREIGN KEY (material_id) REFERENCES materials(id)
        )
      `);

      // Create archives table for prints
      db.run(`
        CREATE TABLE IF NOT EXISTS archives (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          spool_id INTEGER,
          print_name TEXT,
          status TEXT,
          duration_seconds INTEGER,
          energy_kwh REAL,
          energy_cost REAL,
          filament_used_g REAL,
          filament_cost REAL,
          total_cost REAL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          timelapse_path TEXT,
          photo_path TEXT,
          thumbnail_path TEXT,
          FOREIGN KEY (spool_id) REFERENCES spools(id)
        )
      `);
      
      // Create ams_assignments table
      db.run(`
        CREATE TABLE IF NOT EXISTS ams_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tray_id TEXT UNIQUE NOT NULL,
          spool_id INTEGER,
          FOREIGN KEY (spool_id) REFERENCES spools(id)
        )
      `);

      // Create archive_spools junction table - records exactly which spools were used for each print
      db.run(`
        CREATE TABLE IF NOT EXISTS archive_spools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          archive_id INTEGER NOT NULL,
          spool_id INTEGER NOT NULL,
          weight_used_g REAL,
          FOREIGN KEY (archive_id) REFERENCES archives(id),
          FOREIGN KEY (spool_id) REFERENCES spools(id)
        )
      `);
      
      // Create brand_knowledge_overrides table
      db.run(`
        CREATE TABLE IF NOT EXISTS brand_knowledge_overrides (
          brand_name TEXT PRIMARY KEY,
          weight REAL NOT NULL,
          note TEXT,
          variants_json TEXT
        )
      `);
      
      // Attempt to add new columns to an existing archives table (fails silently if they exist)
      db.run("ALTER TABLE archives ADD COLUMN timelapse_path TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN photo_path TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN thumbnail_path TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN ai_analysis TEXT", () => {});

      // Migrations for existing databases
      db.run('ALTER TABLE spools ADD COLUMN archived INTEGER DEFAULT 0', (err) => { /* ignore if exists */ });
      db.run('ALTER TABLE spools ADD COLUMN subtype TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN location TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN last_used_at DATETIME', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN last_print_name TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN shopify_variant_id TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN color_name TEXT', (err) => {
        resolve(); // Resolve promise after the last query in serialize block finishes
      });
    });
  });
};

const populateDefaults = () => {
  const defaultBrands = [
    ['Bambu Lab', 256],
    ['Creality', 140],
    ['Elegoo', 138],
    ['Eryone', 220],
    ['eSUN (Cardboard)', 160],
    ['eSUN (Plastic)', 224],
    ['Geeetech', 230],
    ['Hatchbox (Plastic)', 225],
    ['Landu', 250],
    ['MatterHackers (Build Series)', 213],
    ['MatterHackers (Pro Series)', 312],
    ['MatterHackers (Quantum)', 217],
    ['Overture (Cardboard)', 165],
    ['Overture (Plastic)', 237],
    ['Polymaker (Cardboard)', 145],
    ['Polymaker (Plastic)', 148],
    ['Prusament', 201],
    ['Sunlu (Cardboard)', 170],
    ['Sunlu (Plastic)', 190],
    ['Generic', 250]
  ];
  
  db.get('SELECT COUNT(*) as count FROM brands', (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare('INSERT INTO brands (name, default_empty_weight) VALUES (?, ?)');
      defaultBrands.forEach(b => stmt.run(b[0], b[1]));
      stmt.finalize();
    }
  });

  const defaultMaterials = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'PC', 'Nylon'];
  db.get('SELECT COUNT(*) as count FROM materials', (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare('INSERT INTO materials (name) VALUES (?)');
      defaultMaterials.forEach(m => stmt.run(m));
      stmt.finalize();
    }
  });

  // Run legacy brand cleanup migration
  runLegacyBrandCleanup();
};

const runLegacyBrandCleanup = () => {
  db.all('SELECT * FROM brands', [], (err, rows) => {
    if (err) { console.error(err); return; }

    const groups = {};
    rows.forEach(r => {
      const baseName = r.name.replace(/\(.*?\)/g, '').trim();
      const key = baseName.toLowerCase();
      if (!groups[key]) groups[key] = { baseName, dupes: [] };
      groups[key].dupes.push(r);
    });

    Object.values(groups).forEach(group => {
      const dupes = group.dupes;
      if (dupes.length === 1) {
        const item = dupes[0];
        if (item.name !== group.baseName) {
          db.run('UPDATE brands SET name = ? WHERE id = ?', [group.baseName, item.id], (err) => {
            if (err) console.error('Error migrating legacy brand:', err);
          });
        }
        return;
      }

      dupes.sort((a, b) => a.id - b.id);
      let keep = dupes.find(d => d.name.toLowerCase() === group.baseName.toLowerCase());
      if (!keep) keep = dupes[0];

      const toDelete = dupes.filter(d => d.id !== keep.id);
      const idsToDelete = toDelete.map(d => d.id);

      if (keep.name !== group.baseName) {
        db.run('UPDATE brands SET name = ? WHERE id = ?', [group.baseName, keep.id]);
      }

      const placeholders = idsToDelete.map(() => '?').join(',');
      db.run(`UPDATE spools SET brand_id = ? WHERE brand_id IN (${placeholders})`, [keep.id, ...idsToDelete], (err) => {
        if (!err) {
          db.run(`DELETE FROM brands WHERE id IN (${placeholders})`, idsToDelete);
        }
      });
    });
  });
};

module.exports = {
  db,
  initDb,
  populateDefaults
};
