const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const dataDir = path.join(__dirname, 'data');
const backupsDir = path.join(dataDir, 'backups');
const dbPath = path.join(dataDir, 'filamentmanager.db');

if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

/**
 * Creates a zip backup of the database.
 * @returns {string} The filename of the created backup.
 */
const createBackup = () => {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file not found.');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `backup_${timestamp}.zip`;
  const backupPath = path.join(backupsDir, backupFilename);

  const zip = new AdmZip();
  zip.addLocalFile(dbPath);
  zip.writeZip(backupPath);

  return backupFilename;
};

/**
 * Prunes old backups to maintain the retention count.
 * @param {number} retentionCount Number of backups to keep.
 */
const pruneBackups = (retentionCount) => {
  if (retentionCount <= 0) return;
  
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup_') && f.endsWith('.zip'))
    .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (files.length > retentionCount) {
    const toDelete = files.slice(retentionCount);
    for (const file of toDelete) {
      try {
        fs.unlinkSync(path.join(backupsDir, file.name));
        console.log(`[Backup] Pruned old backup: ${file.name}`);
      } catch (err) {
        console.error(`[Backup] Failed to prune ${file.name}:`, err.message);
      }
    }
  }
};

/**
 * Checks if an auto backup is due and runs it.
 * @param {object} db The sqlite3 database connection to read/write settings.
 */
const autoBackupCheck = (db) => {
  db.all('SELECT key, value FROM settings WHERE key IN ("auto_backup_enabled", "auto_backup_interval_days", "auto_backup_retention", "last_auto_backup_time")', (err, rows) => {
    if (err || !rows) return;
    
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);

    if (settings.auto_backup_enabled !== 'true') return;

    const intervalDays = parseInt(settings.auto_backup_interval_days || '1', 10);
    const retentionCount = parseInt(settings.auto_backup_retention || '5', 10);
    const lastTime = settings.last_auto_backup_time ? new Date(settings.last_auto_backup_time).getTime() : 0;
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;

    if (now - lastTime >= intervalDays * msInDay) {
      console.log(`[Backup] Running scheduled auto-backup (Interval: ${intervalDays} days)`);
      try {
        createBackup();
        pruneBackups(retentionCount);
        db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_auto_backup_time', new Date().toISOString()]);
      } catch (backupErr) {
        console.error(`[Backup] Auto-backup failed:`, backupErr.message);
      }
    }
  });
};

module.exports = {
  createBackup,
  pruneBackups,
  autoBackupCheck,
  backupsDir
};
