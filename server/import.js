const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { db } = require('./database');

const importBambuddyDb = (filePath) => {
  return new Promise((resolve, reject) => {
    const bdb = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    bdb.all("SELECT * FROM spool", [], (err, spools) => {
      if (err) { bdb.close(); return reject(err); }
      bdb.close();

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const brandMap = {};
        const materialMap = {};

        // Extract unique brands
        const uniqueBrands = [...new Set(spools.map(s => s.brand).filter(Boolean))];
        const insertBrand = db.prepare('INSERT OR IGNORE INTO brands (name, default_empty_weight) VALUES (?, ?)');
        uniqueBrands.forEach(b => insertBrand.run(b, 250));
        insertBrand.finalize();

        // Extract unique materials
        const uniqueMats = [...new Set(spools.map(s => s.material).filter(Boolean))];
        const insertMat = db.prepare('INSERT OR IGNORE INTO materials (name) VALUES (?)');
        uniqueMats.forEach(m => insertMat.run(m));
        insertMat.finalize();

        // Resolve IDs
        db.all('SELECT id, name FROM brands', [], (err, brandRows) => {
          if (err) return reject(err);
          brandRows.forEach(r => brandMap[r.name] = r.id);

          db.all('SELECT id, name FROM materials', [], (err, matRows) => {
            if (err) return reject(err);
            matRows.forEach(r => materialMap[r.name] = r.id);

            const insertSpool = db.prepare(`
              INSERT INTO spools (brand_id, material_id, color, cost, total_weight, empty_weight, used_weight) 
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            spools.forEach(s => {
              const brandId = s.brand ? brandMap[s.brand] : null;
              const matId = s.material ? materialMap[s.material] : null;

              let color = '#ffffff';
              if (s.rgba) {
                // rgba is likely a hex string like "FF0000FF", or JSON. Let's just grab the first 6 hex chars if possible
                let hexMatch = s.rgba.match(/[0-9A-Fa-f]{6}/);
                if (hexMatch) {
                  color = '#' + hexMatch[0];
                }
              }

              const totalWeight = s.label_weight || 1000;
              const emptyWeight = s.core_weight || 250;
              const usedWeight = s.weight_used || 0;
              const cost = s.cost_per_kg || 0;

              insertSpool.run(brandId, matId, color, cost, totalWeight, emptyWeight, usedWeight);
            });

            insertSpool.finalize();
            
            db.run('COMMIT', (err) => {
              if (err) return reject(err);
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
};

module.exports = { importBambuddyDb };
