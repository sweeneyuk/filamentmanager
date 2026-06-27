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
      
      bdb.all("PRAGMA table_info('filaments')", [], (err, filCols) => {
        bdb.all("PRAGMA table_info('spool')", [], (err, spoolCols) => {
          bdb.close();
          const filColNames = filCols ? filCols.map(c => c.name).join(', ') : 'none';
          const spoolColNames = spoolCols ? spoolCols.map(c => c.name).join(', ') : 'none';
          return reject(new Error(`Please give this to the developer: Filaments(${filColNames}) | Spools(${spoolColNames})`));
        });
      });
    });
  });
};

module.exports = { importBambuddyDb };
