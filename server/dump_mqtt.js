const mqtt = require('mqtt');
const { db, initDb } = require('./database');

initDb().then(() => {
  db.get('SELECT value FROM settings WHERE key = ?', ['bambu_ip'], (err, row1) => {
    const ip = row1.value;
    db.get('SELECT value FROM settings WHERE key = ?', ['bambu_access_code'], (err, row2) => {
      const accessCode = row2.value;
      db.get('SELECT value FROM settings WHERE key = ?', ['bambu_serial'], (err, row3) => {
        const serial = row3.value;
        const client = mqtt.connect(`mqtts://${ip}:8883`, {
          username: 'bblp',
          password: accessCode,
          rejectUnauthorized: false
        });
        client.on('connect', () => {
          client.subscribe(`device/${serial}/report`);
        });
        client.on('message', (topic, message) => {
          const payload = JSON.parse(message.toString());
          if (payload.print) {
            require('fs').writeFileSync('mqtt_dump.json', JSON.stringify(payload.print, null, 2));
            console.log('Dumped payload.');
            process.exit(0);
          }
        });
      });
    });
  });
});
