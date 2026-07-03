const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'filamentmanager.db');
const db = new sqlite3.Database(dbPath);

function dedupeBrands() {
  db.all('SELECT * FROM brands', [], (err, rows) => {
    if (err) { console.error('Error fetching brands', err); return; }
    // Group by lowercase name
    const groups = {};
    rows.forEach(r => {
      const key = r.name.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    Object.values(groups).forEach(dupes => {
      if (dupes.length <= 1) return;
      // Keep the entry with the highest id (assumed newest/fetched)
      dupes.sort((a, b) => b.id - a.id);
      const keep = dupes[0];
      const toDelete = dupes.slice(1);
      const idsToDelete = toDelete.map(d => d.id);
      // Update spools that reference deleted brand ids to the kept id
      const placeholders = idsToDelete.map(() => '?').join(',');
      db.run(`UPDATE spools SET brand_id = ? WHERE brand_id IN (${placeholders})`, [keep.id, ...idsToDelete], function(err) {
        if (err) console.error('Error updating spools brand_id', err);
      });
      // Delete duplicate rows
      db.run(`DELETE FROM brands WHERE id IN (${placeholders})`, idsToDelete, function(err) {
        if (err) console.error('Error deleting duplicate brands', err);
        else console.log(`Deduped ${idsToDelete.length} duplicate brands for name '${keep.name}'`);
      });
    });
  });
}

function dedupeMaterials() {
  db.all('SELECT * FROM materials', [], (err, rows) => {
    if (err) { console.error('Error fetching materials', err); return; }
    const groups = {};
    rows.forEach(r => {
      const key = r.name.trim().toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    Object.values(groups).forEach(dupes => {
      if (dupes.length <= 1) return;
      dupes.sort((a, b) => b.id - a.id);
      const keep = dupes[0];
      const toDelete = dupes.slice(1);
      const idsToDelete = toDelete.map(d => d.id);
      const placeholders = idsToDelete.map(() => '?').join(',');
      // Update spools that reference deleted material ids to the kept id
      db.run(`UPDATE spools SET material_id = ? WHERE material_id IN (${placeholders})`, [keep.id, ...idsToDelete], function(err) {
        if (err) console.error('Error updating spools material_id', err);
      });
      // Delete duplicate rows
      db.run(`DELETE FROM materials WHERE id IN (${placeholders})`, idsToDelete, function(err) {
        if (err) console.error('Error deleting duplicate materials', err);
        else console.log(`Deduped ${idsToDelete.length} duplicate materials for name '${keep.name}'`);
      });
    });
  });
}

function run() {
  db.serialize(() => {
    dedupeBrands();
    dedupeMaterials();
    // Close after short delay to allow async updates
    setTimeout(() => db.close(), 2000);
  });
}

run();
