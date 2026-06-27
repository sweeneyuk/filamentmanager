const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { db } = require('./database');

const importBambuddyDb = (filePath) => {
  return new Promise((resolve, reject) => {
    const bdb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    bdb.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
      if (err) { bdb.close(); return reject(err); }
      const tableNames = tables.map(t => t.name);
      
      const filamentTable = tableNames.includes('filaments') ? 'filaments' : (tableNames.includes('filament') ? 'filament' : null);
      const vendorTable = tableNames.includes('vendors') ? 'vendors' : (tableNames.includes('vendor') ? 'vendor' : (tableNames.includes('brands') ? 'brands' : null));
      const spoolTable = tableNames.includes('spools') ? 'spools' : (tableNames.includes('spool') ? 'spool' : null);

      if (!filamentTable || !vendorTable || !spoolTable) {
        bdb.close();
        return reject(new Error(`Could not identify all required tables. Found tables: ${tableNames.join(', ')}`));
      }

      // 1. Fetch materials, vendors (brands), and spools from bambuddy DB
      bdb.all(`SELECT * FROM ${filamentTable}`, [], (err, filaments) => {
        if (err) { bdb.close(); return reject(err); }
        
        bdb.all(`SELECT * FROM ${vendorTable}`, [], (err, vendors) => {
          if (err) { bdb.close(); return reject(err); }

          bdb.all(`SELECT * FROM ${spoolTable}`, [], (err, spools) => {
            if (err) { bdb.close(); return reject(err); }

            bdb.close();

          // Proceed to map and insert into our DB
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const brandMap = {};
            const materialMap = {};

            // Insert vendors as brands
            const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, default_empty_weight) VALUES (?, ?)');
            vendors.forEach(v => insertBrand.run(v.name, v.empty_spool_weight || 250));
            insertBrand.finalize();

            // Insert materials
            const insertMat = db.prepare('INSERT OR IGNORE INTO materials (name) VALUES (?)');
            filaments.forEach(f => {
              if (f.material) insertMat.run(f.material);
            });
            insertMat.finalize();

            // Resolve IDs after insert (sqlite INSERT OR IGNORE doesn't return ID easily if ignored, so we query)
            db.all('SELECT id, name FROM brands', [], (err, brandRows) => {
              if (err) return reject(err);
              brandRows.forEach(r => brandMap[r.name] = r.id);

              db.all('SELECT id, name FROM materials', [], (err, matRows) => {
                if (err) return reject(err);
                matRows.forEach(r => materialMap[r.name] = r.id);

                // Insert spools
                const insertSpool = db.prepare(`
                  INSERT INTO spools (brand_id, material_id, color, cost, total_weight, empty_weight, used_weight) 
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `);

                spools.forEach(s => {
                  // Find the linked filament for this spool
                  const fil = filaments.find(f => f.id === s.filament_id);
                  if (!fil) return;
                  
                  // Find linked vendor
                  const ven = vendors.find(v => v.id === fil.vendor_id);
                  const brandId = ven ? brandMap[ven.name] : null;
                  const matId = fil.material ? materialMap[fil.material] : null;

                  const color = fil.color_hex ? `#${fil.color_hex}` : '#ffffff';
                  const totalWeight = fil.weight || 1000;
                  const emptyWeight = fil.empty_spool_weight || 250;
                  const usedWeight = s.used_weight || 0;
                  const cost = fil.price || 0;

                  insertSpool.run(brandId, matId, color, cost, totalWeight, emptyWeight, usedWeight);
                });

                insertSpool.finalize();
                
                db.run('COMMIT', (err) => {
                  if (err) return reject(err);
                  // Cleanup uploaded file
                  if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                  }
                  resolve();
                });
              });
            });
          });
        });
      });
    });
  });
};

module.exports = { importBambuddyDb };
