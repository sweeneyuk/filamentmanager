const { getPredictedWeights } = require('./ftp');

async function test() {
  console.log('Testing extraction for Cube...');
  const weights = await getPredictedWeights('/data/Metadata/plate_1.gcode', 'Cube');
  console.log('Extracted Weights Array:', weights);
  
  if (weights && weights.length > 0) {
    console.log('SUCCESS! Extracted weight is:', weights[0], 'grams');
  } else {
    console.log('FAILED to extract weights.');
  }
}

test();
