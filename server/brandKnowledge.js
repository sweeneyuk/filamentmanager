/**
 * Brand Spool Weight Knowledge Base
 *
 * Data compiled from multiple sources:
 * - SpoolmanDB (github.com/Donkie/SpoolmanDB)
 * - theemptyspool.cc community database
 * - printables.com/model/464663 (Empty Spool Weight Catalog)
 * - stldenise3d.com community measurements
 * - filamiq.com database
 * - onlyspoolz.com
 * - Reddit r/3Dprinting, r/BambuLab community threads
 * - Official brand sources where available (ColorFabb, MatterHackers)
 *
 * Each entry has:
 *   brand        - Brand name (matched case-insensitively)
 *   weight       - Recommended default empty spool weight in grams (most common 1kg plastic spool)
 *   confidence   - 'high' | 'medium' | 'low'
 *   note         - Human-readable note about variability or spool types
 *   variants     - Optional array for brands with meaningfully different spool types
 *                  { label, weight } - used to populate a secondary suggestion
 *
 * When a user selects a brand in the UI, the `weight` value should auto-fill the
 * "Empty Weight" field, and the `note` should be shown as a helper hint.
 */

const BRAND_SPOOL_WEIGHTS = [
  {
    brand: "123-3D",
    weight: 216,
    confidence: "medium",
    note: "Standard 1kg plastic spool"
  },
  {
    brand: "3D Fuel",
    weight: 264,
    confidence: "medium",
    note: "Heavy-duty plastic spool"
  },
  {
    brand: "3D Solutech",
    weight: 173,
    confidence: "medium",
    note: "Lightweight plastic spool"
  },
  {
    brand: "3DJake",
    weight: 209,
    confidence: "medium",
    note: "Typically cardboard ~209g; plastic spools ~240g",
    variants: [
      { label: "Cardboard spool", weight: 209 },
      { label: "Plastic spool", weight: 240 },
      { label: "250g small plastic spool", weight: 91 }
    ]
  },
  {
    brand: "3DXTech",
    weight: 258,
    confidence: "medium",
    note: "Heavy plastic engineering-grade spool"
  },
  {
    brand: "Amazon Basics",
    weight: 220,
    confidence: "low",
    note: "Wide range reported (190–250g); weigh your spool for accuracy"
  },
  {
    brand: "Amolen",
    weight: 190,
    confidence: "medium",
    note: "Standard 1kg plastic spool"
  },
  {
    brand: "Anycubic",
    weight: 163,
    confidence: "medium",
    note: "Newer spool design ~163g; older design ~127g",
    variants: [
      { label: "Newer spool design (2022+)", weight: 163 },
      { label: "Older spool design", weight: 127 }
    ]
  },
  {
    brand: "Atomic Filament",
    weight: 306,
    confidence: "medium",
    note: "Very heavy-duty industrial plastic spool"
  },
  {
    brand: "Bambu Lab",
    weight: 250,
    confidence: "high",
    note: "Varies by material type: PLA/PETG/Matte/Silk ~208g (light grey), ABS/ASA/PA/PC ~216g (dark grey), Refill pack ~37g, Universal reusable spool ~250g",
    variants: [
      { label: "PLA / PETG / Matte / Silk / TPU (light grey spool)", weight: 208 },
      { label: "ABS / ASA / PA / PC (dark grey spool)", weight: 216 },
      { label: "Refill pack (cardboard core only)", weight: 37 },
      { label: "Bambu Reusable Spool (accessory)", weight: 250 }
    ]
  },
  {
    brand: "CC3D",
    weight: 166,
    confidence: "medium",
    note: "Lightweight plastic spool (range 162–171g)"
  },
  {
    brand: "ColorFabb",
    weight: 152,
    confidence: "high",
    note: "750g standard cardboard spool: 152g (officially confirmed by ColorFabb). Note: ColorFabb uses 750g as standard, not 1kg",
    variants: [
      { label: "750g cardboard spool (standard)", weight: 152 },
      { label: "750g plastic spool (some specialty lines)", weight: 236 },
      { label: "2.2kg plastic spool", weight: 600 }
    ]
  },
  {
    brand: "Cookie Cad",
    weight: 175,
    confidence: "medium",
    note: "Standard 1kg plastic spool"
  },
  {
    brand: "Creality",
    weight: 140,
    confidence: "medium",
    note: "Standard Ender/Sermoon PLA spool ~140g; Hyper PLA uses heavier spool ~215g",
    variants: [
      { label: "Standard Ender/Sermoon PLA spool", weight: 140 },
      { label: "Hyper PLA spool", weight: 215 }
    ]
  },
  {
    brand: "Das Filament",
    weight: 211,
    confidence: "medium",
    note: "Very consistent across reports; 0.8kg spool size standard"
  },
  {
    brand: "Das Filament (3DJake)",
    weight: 211,
    confidence: "medium",
    note: "OEM / rebranded Das Filament spool"
  },
  {
    brand: "Devil Design",
    weight: 250,
    confidence: "medium",
    note: "Consistent plastic spool (range 250–265g)"
  },
  {
    brand: "Elegoo",
    weight: 155,
    confidence: "medium",
    note: "Cardboard spool ~165g; older lighter plastic spool ~111g",
    variants: [
      { label: "Cardboard spool", weight: 165 },
      { label: "Plastic spool (older/lighter)", weight: 111 }
    ]
  },
  {
    brand: "Eryone",
    weight: 267,
    confidence: "medium",
    note: "Relatively heavy 1kg plastic spool"
  },
  {
    brand: "eSUN",
    weight: 224,
    confidence: "medium",
    note: "Plastic spool ~224g (most common); newer eco cardboard spools ~165g",
    variants: [
      { label: "Plastic spool (standard)", weight: 224 },
      { label: "Cardboard/eco spool (newer lines)", weight: 165 }
    ]
  },
  {
    brand: "Fiberlogy",
    weight: 245,
    confidence: "low",
    note: "Wide range due to spool generations: newer ~245g, older rounded donut-style ~325g. Recommend weighing your own spool.",
    variants: [
      { label: "Newer/current spool design", weight: 245 },
      { label: "Older rounded/donut-style spool", weight: 325 }
    ]
  },
  {
    brand: "Fillamentum",
    weight: 230,
    confidence: "low",
    note: "750g standard spool (not 1kg); range 185–235g across reports. Weigh your spool."
  },
  {
    brand: "Flashforge",
    weight: 168,
    confidence: "medium",
    note: "Plastic spool ~168g; cardboard spool ~139g",
    variants: [
      { label: "Plastic spool", weight: 168 },
      { label: "Cardboard spool", weight: 139 }
    ]
  },
  {
    brand: "FormFutura",
    weight: 172,
    confidence: "medium",
    note: "Primarily cardboard spools: EasyFil ~180g, ReForm rPLA ~165g, avg ~172g",
    variants: [
      { label: "EasyFil cardboard spool", weight: 180 },
      { label: "ReForm rPLA cardboard spool", weight: 165 },
      { label: "Plastic spool (older specialty lines)", weight: 212 }
    ]
  },
  {
    brand: "Geeetech",
    weight: 170,
    confidence: "low",
    note: "Very wide range (114–262g) due to many spool designs. Recommend weighing your spool."
  },
  {
    brand: "Hatchbox",
    weight: 225,
    confidence: "medium",
    note: "Consistent plastic spool; some batch variation (179–245g range reported)"
  },
  {
    brand: "Inland",
    weight: 225,
    confidence: "medium",
    note: "MicroCenter brand. Black plastic ~225g, clear ~215g, cardboard ~142g",
    variants: [
      { label: "Black plastic spool", weight: 225 },
      { label: "Clear/rainbow plastic spool", weight: 215 },
      { label: "Cardboard spool", weight: 142 }
    ]
  },
  {
    brand: "Jessie (Printed Solid)",
    weight: 276,
    confidence: "medium",
    note: "Unusually heavy: cardboard ~276g, plastic ~297g",
    variants: [
      { label: "Cardboard spool", weight: 276 },
      { label: "Plastic spool", weight: 297 }
    ]
  },
  {
    brand: "Keene Village Plastics",
    weight: 211,
    confidence: "low",
    note: "Wide range reported (211–310g)"
  },
  {
    brand: "MakerBot",
    weight: 290,
    confidence: "medium",
    note: "Heavy plastic spool typical of MakerBot packaging"
  },
  {
    brand: "MatterHackers",
    weight: 215,
    confidence: "high",
    note: "Officially documented: Build Series ~212–215g, Quantum ~217g, Pro Series ~312g",
    variants: [
      { label: "Build Series", weight: 212 },
      { label: "Quantum Series", weight: 217 },
      { label: "Pro Series (engineering materials)", weight: 312 }
    ]
  },
  {
    brand: "Overture",
    weight: 237,
    confidence: "medium",
    note: "Plastic spools ~237g (most products); cardboard/eco spools ~162g",
    variants: [
      { label: "Plastic spool (standard)", weight: 237 },
      { label: "Cardboard / eco spool", weight: 162 }
    ]
  },
  {
    brand: "Paramount 3D",
    weight: 208,
    confidence: "medium",
    note: "Standard 1kg plastic spool"
  },
  {
    brand: "Polymaker",
    weight: 140,
    confidence: "medium",
    note: "Cardboard spools on current products ~140–145g; older plastic ~179g",
    variants: [
      { label: "Cardboard spool (current — most products)", weight: 140 },
      { label: "Plastic spool (older products)", weight: 179 }
    ]
  },
  {
    brand: "Printerior",
    weight: 113,
    confidence: "medium",
    note: "Lightweight cardboard spool"
  },
  {
    brand: "ProtoPasta",
    weight: 80,
    confidence: "medium",
    note: "Very light cardboard spool; standard size is 0.5kg (500g) not 1kg"
  },
  {
    brand: "Prusament",
    weight: 201,
    confidence: "high",
    note: "Very consistent black plastic spool across all materials (~200–205g). Prusament publishes a per-spool calculator at prusament.com using the spool QR code for precision."
  },
  {
    brand: "Push Plastic",
    weight: 328,
    confidence: "medium",
    note: "Very heavy industrial-grade plastic spool"
  },
  {
    brand: "Raise3D",
    weight: 246,
    confidence: "medium",
    note: "Standard 1kg plastic spool"
  },
  {
    brand: "Rigid.ink",
    weight: 235,
    confidence: "medium",
    note: "750g spool (not 1kg); plastic construction"
  },
  {
    brand: "Spectrum Filaments",
    weight: 180,
    confidence: "medium",
    note: "Cardboard spools ~180g; plastic spools ~260g",
    variants: [
      { label: "Cardboard spool", weight: 180 },
      { label: "Plastic spool", weight: 260 }
    ]
  },
  {
    brand: "StrongHero3D",
    weight: 151,
    confidence: "medium",
    note: "Lightweight plastic spool"
  },
  {
    brand: "Sunlu",
    weight: 200,
    confidence: "medium",
    note: "Newer Gen 3 spool ~200–215g; older Gen 1/2 spool ~132–163g. Gen 3 has printed weight scale on the side.",
    variants: [
      { label: "Gen 3 spool (2022+, has weight markings)", weight: 200 },
      { label: "Gen 1/2 spool (older)", weight: 132 }
    ]
  },
  {
    brand: "Tinmorry",
    weight: 185,
    confidence: "medium",
    note: "Standard 1kg plastic spool"
  },
  {
    brand: "Ultimaker",
    weight: 230,
    confidence: "medium",
    note: "750g spool (not 1kg); consistent plastic construction"
  },
  {
    brand: "Ziro",
    weight: 196,
    confidence: "low",
    note: "Range 165–226g reported; recommend weighing your spool"
  }
];

/**
 * Look up a brand's spool weight data by name (case-insensitive, partial match).
 * Returns the entry or null if not found.
 */
function lookupBrand(brandName) {
  if (!brandName) return null;
  const lower = brandName.toLowerCase().trim();
  return BRAND_SPOOL_WEIGHTS.find(b =>
    b.brand.toLowerCase() === lower ||
    b.brand.toLowerCase().includes(lower) ||
    lower.includes(b.brand.toLowerCase())
  ) || null;
}

/**
 * Get all brand names (for autocomplete / suggestions).
 */
function getAllBrandNames() {
  return BRAND_SPOOL_WEIGHTS.map(b => b.brand);
}

module.exports = { BRAND_SPOOL_WEIGHTS, lookupBrand, getAllBrandNames };
