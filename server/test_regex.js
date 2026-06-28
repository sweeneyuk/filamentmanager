const fs = require('fs');

const contentStr = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
  </header>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="weight" value="1.70"/>
    <object identify_id="69" name="Cube" skipped="false" />
    <filament id="4" tray_info_idx="GFL99" type="PLA" color="#054795" used_m="0.57" used_g="1.70" group_id="0" nozzle_diameter="0.40" volume_type="Standard" used_for_object="true" used_for_support="false"/>
  </plate>
</config>`;

const filamentRegex = /<filament\s+[^>]*used_g="([\d\.]+)"/gi;
const weights = [];
let match;
while ((match = filamentRegex.exec(contentStr)) !== null) {
  weights.push(parseFloat(match[1]));
}

console.log('Extracted Weights:', weights);
