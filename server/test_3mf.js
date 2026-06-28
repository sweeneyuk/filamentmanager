const { connectFtp } = require('./ftp');
const AdmZip = require('adm-zip');
const fs = require('fs');

async function test3mf() {
  const client = await connectFtp();
  try {
    await client.downloadTo('test_Cube.3mf', '/Cube.gcode.3mf');
    const zip = new AdmZip('test_Cube.3mf');
    const entries = zip.getEntries();
    console.log('Entries:', entries.map(e => e.entryName));
    
    const detailsEntry = entries.find(e => e.entryName === 'Metadata/project_details.json' || e.entryName === 'Metadata/slice_info.config');
    if (detailsEntry) {
      console.log('Found:', detailsEntry.entryName);
      console.log(detailsEntry.getData().toString('utf8'));
    } else {
      console.log('Could not find Metadata/project_details.json or Metadata/slice_info.config');
      // let's just look for anything with config or json
      const fallback = entries.find(e => e.entryName.includes('.config') || e.entryName.includes('.json'));
      if (fallback) {
        console.log('Fallback found:', fallback.entryName);
      }
    }
  } catch (e) {
    console.log(e);
  } finally {
    client.close();
  }
}

test3mf();
