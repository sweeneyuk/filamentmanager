const { db } = require('./database');

let io = null;

const setBroadcastIo = (ioInstance) => {
  io = ioInstance;
};

const getSpoolRecord = (spoolId) => {
  return new Promise((resolve) => {
    const query = `
      SELECT s.*, b.name as brand_name, m.name as material_name,
             (SELECT GROUP_CONCAT(rfid, ', ') FROM spool_rfids WHERE spool_id = s.id) as rfid_aliases
      FROM spools s 
      LEFT JOIN brands b ON s.brand_id = b.id 
      LEFT JOIN materials m ON s.material_id = m.id
      WHERE s.id = ?
    `;
    db.get(query, [spoolId], (err, row) => {
      resolve(row || null);
    });
  });
};

const getArchiveRecord = (archiveId) => {
  return new Promise((resolve) => {
    const query = `
      SELECT 
        a.*,
        GROUP_CONCAT(CASE WHEN aps.id IS NOT NULL THEN COALESCE(sp.color, '') END, '|') as spool_colors,
        GROUP_CONCAT(CASE WHEN aps.id IS NOT NULL THEN COALESCE(sp.color_name, '') END, '|') as spool_color_names,
        GROUP_CONCAT(CASE WHEN aps.id IS NOT NULL THEN COALESCE(m.name, 'Unknown') END, '|') as spool_materials,
        GROUP_CONCAT(CASE WHEN aps.id IS NOT NULL THEN COALESCE(b.name, 'Unknown') END, '|') as spool_brands,
        GROUP_CONCAT(CASE WHEN aps.id IS NOT NULL THEN COALESCE(aps.weight_used_g, 0) END, '|') as spool_weights
      FROM archives a
      LEFT JOIN archive_spools aps ON aps.archive_id = a.id
      LEFT JOIN spools sp ON aps.spool_id = sp.id
      LEFT JOIN brands b ON sp.brand_id = b.id
      LEFT JOIN materials m ON sp.material_id = m.id
      WHERE a.id = ?
      GROUP BY a.id
    `;
    db.get(query, [archiveId], (err, r) => {
      if (err || !r) return resolve(null);
      resolve({
        ...r,
        spools_used: r.spool_brands ? r.spool_brands.split('|').map((brand, i) => ({
          brand,
          material: r.spool_materials ? r.spool_materials.split('|')[i] : '',
          color: r.spool_colors ? (r.spool_colors.split('|')[i] || null) : null,
          color_name: r.spool_color_names ? (r.spool_color_names.split('|')[i] || null) : null,
          weight_used_g: r.spool_weights ? parseFloat(r.spool_weights.split('|')[i]) : null,
        })) : []
      });
    });
  });
};

const broadcastSpoolUpdated = async (spoolId) => {
  if (!io || !spoolId) return;
  const spool = await getSpoolRecord(spoolId);
  if (spool) {
    io.emit('spool_updated', spool);
  }
};

const broadcastSpoolAdded = async (spoolId) => {
  if (!io || !spoolId) return;
  const spool = await getSpoolRecord(spoolId);
  if (spool) {
    io.emit('spool_added', spool);
  }
};

const broadcastSpoolDeleted = (spoolId) => {
  if (!io || !spoolId) return;
  io.emit('spool_deleted', { id: parseInt(spoolId, 10) });
};

const broadcastArchiveUpdated = async (archiveId) => {
  if (!io || !archiveId) return;
  const arch = await getArchiveRecord(archiveId);
  if (arch) {
    io.emit('archive_updated', arch);
  }
};

const broadcastArchiveDeleted = (archiveId) => {
  if (!io || !archiveId) return;
  io.emit('archive_deleted', { id: parseInt(archiveId, 10) });
};

module.exports = {
  setBroadcastIo,
  getSpoolRecord,
  getArchiveRecord,
  broadcastSpoolUpdated,
  broadcastSpoolAdded,
  broadcastSpoolDeleted,
  broadcastArchiveUpdated,
  broadcastArchiveDeleted
};
