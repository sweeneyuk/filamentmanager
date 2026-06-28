const { connectFtp } = require('./ftp');

async function listFiles() {
  const client = await connectFtp();
  try {
    try {
      const cache = await client.list('/cache');
      console.log('Cache:', cache.map(f => f.name));
    } catch (e) { }
    try {
      const verify = await client.list('/verify_job');
      console.log('verify_job:', verify.map(f => f.name));
    } catch (e) { }
  } catch (e) {
  } finally {
    client.close();
  }
}

listFiles();
