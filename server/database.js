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
          rfid TEXT UNIQUE,
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
          printer_id INTEGER,
          tray_id TEXT NOT NULL,
          spool_id INTEGER,
          UNIQUE(printer_id, tray_id),
          FOREIGN KEY (spool_id) REFERENCES spools(id),
          FOREIGN KEY (printer_id) REFERENCES printers(id)
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
      
      // Create ai_memory table for the chatbot
      db.run(`
        CREATE TABLE IF NOT EXISTS ai_memory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          topic TEXT UNIQUE NOT NULL,
          insight_text TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create scrap_models table for Scrap Saver
      db.run(`
        CREATE TABLE IF NOT EXISTS scrap_models (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          weight_g REAL NOT NULL,
          url TEXT,
          description TEXT
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
      
      // Create jobs table for quotes and sales
      db.run(`
        CREATE TABLE IF NOT EXISTS jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name TEXT NOT NULL,
          customer_name TEXT,
          notes TEXT,
          status TEXT DEFAULT 'Quote',
          filament_cost REAL DEFAULT 0,
          electricity_cost REAL DEFAULT 0,
          wear_cost REAL DEFAULT 0,
          labor_cost REAL DEFAULT 0,
          total_cost REAL DEFAULT 0,
          markup_amount REAL DEFAULT 0,
          final_price REAL DEFAULT 0,
          print_time_hours REAL DEFAULT 0,
          spool_data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Create printers table
      db.run(`
        CREATE TABLE IF NOT EXISTS printers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          ip TEXT NOT NULL,
          serial TEXT NOT NULL,
          access_code TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Attempt to add new columns to an existing archives table (fails silently if they exist)
      db.run("ALTER TABLE archives ADD COLUMN timelapse_path TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN photo_path TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN thumbnail_path TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN ai_analysis TEXT", () => {});
      db.run("ALTER TABLE archives ADD COLUMN printer_id INTEGER", () => {});
      db.run("ALTER TABLE ams_assignments ADD COLUMN printer_id INTEGER", () => {});

      // Migrations for existing databases
      db.run('ALTER TABLE spools ADD COLUMN archived INTEGER DEFAULT 0', (err) => { /* ignore if exists */ });
      db.run('ALTER TABLE spools ADD COLUMN subtype TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN location TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN last_used_at DATETIME', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN last_print_name TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN shopify_variant_id TEXT', (err) => { /* ignore */ });
      db.run('ALTER TABLE spools ADD COLUMN rfid TEXT', (err) => { 
        if (err && !err.message.includes("duplicate column name")) console.error("Migration error (rfid):", err.message); 
      });
      db.run('ALTER TABLE spools ADD COLUMN color_name TEXT', (err) => {
        // Multi-printer migration: Migrate global bambu settings to a printer record
        db.get("SELECT COUNT(*) as count FROM printers", (err, row) => {
          if (!err && row && row.count === 0) {
            db.all("SELECT key, value FROM settings WHERE key IN ('bambu_ip', 'bambu_serial', 'bambu_access_code')", (err, rows) => {
              if (!err && rows && rows.length > 0) {
                const map = {};
                rows.forEach(r => map[r.key] = r.value);
                if (map.bambu_ip && map.bambu_serial) {
                  db.run(
                    "INSERT INTO printers (id, name, ip, serial, access_code) VALUES (1, 'Primary Printer', ?, ?, ?)",
                    [map.bambu_ip, map.bambu_serial, map.bambu_access_code || ''],
                    function(err) {
                      if (!err) {
                        console.log('Migrated legacy Bambu settings to printers table.');
                        // Clean up legacy settings
                        db.run("DELETE FROM settings WHERE key IN ('bambu_ip', 'bambu_serial', 'bambu_access_code')");
                      }
                      migrateAmsSchema(resolve);
                    }
                  );
                } else {
                  migrateAmsSchema(resolve);
                }
              } else {
                migrateAmsSchema(resolve);
              }
            });
          } else {
            migrateAmsSchema(resolve);
          }
        });
      });
    });
  });
};

const migrateAmsSchema = (resolve) => {
  db.all("PRAGMA table_info(ams_assignments)", (err, rows) => {
    // Check if it has the old schema (tray_id is unique, printer_id might be missing or added via ALTER)
    // We check if we need to migrate by seeing if the unique constraint is correct, or just looking at table info.
    // Actually, recreating the table IF it exists and has the old structure is safest.
    // We'll run the migration if we haven't renamed it yet.
    
    // We can check if `ams_assignments` exists and `printer_id` is part of it. If printer_id was added by ALTER, 
    // it will be there, but the UNIQUE constraint on tray_id still exists.
    // Let's check if there is an index on tray_id that enforces uniqueness.
    db.all("PRAGMA index_list(ams_assignments)", (err, indexes) => {
      if (err) return resolve();
      const hasUniqueTrayId = indexes.some(idx => idx.unique === 1);
      
      // If we find the old unique constraint on tray_id (or if we just want to be safe and ensure the schema),
      // we can do the migration. We will create ams_assignments_new with the correct schema.
      db.run(`CREATE TABLE IF NOT EXISTS ams_assignments_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        printer_id INTEGER,
        tray_id TEXT NOT NULL,
        spool_id INTEGER,
        UNIQUE(printer_id, tray_id),
        FOREIGN KEY (spool_id) REFERENCES spools(id),
        FOREIGN KEY (printer_id) REFERENCES printers(id)
      )`, (err) => {
        if (err) return resolve();
        
        // Copy data over. Ensure we have printer_id.
        const hasPrinterId = rows && rows.some(r => r.name === 'printer_id');
        const insertQuery = hasPrinterId 
          ? `INSERT OR IGNORE INTO ams_assignments_new (printer_id, tray_id, spool_id) SELECT IFNULL(printer_id, 1), tray_id, spool_id FROM ams_assignments`
          : `INSERT OR IGNORE INTO ams_assignments_new (printer_id, tray_id, spool_id) SELECT 1, tray_id, spool_id FROM ams_assignments`;
          
        db.run(insertQuery, (err) => {
          if (!err) {
            db.run(`DROP TABLE ams_assignments`, (err) => {
              if (!err) {
                db.run(`ALTER TABLE ams_assignments_new RENAME TO ams_assignments`, (err) => {
                  // Link any remaining archives to printer 1 if null
                  db.run("UPDATE archives SET printer_id = 1 WHERE printer_id IS NULL", () => {
                    resolve();
                  });
                });
              } else {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
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

const getQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const allQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

module.exports = {
  db,
  initDb,
  populateDefaults,
  getQuery,
  allQuery,
  runQuery
};
