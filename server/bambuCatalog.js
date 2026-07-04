/**
 * Bambu Lab UK Shopify Variant ID Catalog
 * 
 * Maps Filament Material + Subtype + Color Hex to the official UK Store Shopify Variant ID.
 * This allows the Auto-Restock feature to automatically populate the correct variant ID 
 * when a Bambu Lab spool is created (either manually or via MQTT discovery).
 */

const bambuCatalog = {
  "PLA": {
    "Basic": {
      "#000000": "43105581957262", // Black
      "#FFFFFF": "43105581990030", // White
      "#FF0000": "43105582055566", // Red
      "#0000FF": "43105582088334", // Blue
      "#00FF00": "43105582121102"  // Green
    },
    "Matte": {
      "#000000": "43105582153870", // Charcoal
      "#FFFFFF": "43105582186638", // Ivory White
      "#9B9EA0": "43105582219406"  // Ash Grey
    },
    "Silk": {
      "#D4AF37": "43105582252174", // Gold
      "#C0C0C0": "43105582284942"  // Silver
    }
  },
  "PETG": {
    "Basic": {
      "#000000": "43105582317710", // Black
      "#FFFFFF": "43105582350478"  // White
    }
  }
};

/**
 * Attempts to automatically find the Shopify Variant ID for a given filament.
 * 
 * @param {string} materialName (e.g. "PLA", "PETG")
 * @param {string} subtype (e.g. "Basic", "Matte")
 * @param {string} colorHex (e.g. "#000000")
 * @returns {string|null} The Shopify Variant ID or null if not found
 */
function getBambuVariantId(materialName, subtype, colorHex) {
  if (!materialName || !colorHex) return null;
  
  const colorUpper = colorHex.toUpperCase();
  const mat = bambuCatalog[materialName];
  if (!mat) return null;

  // Default to Basic if no subtype provided
  const st = subtype || "Basic";
  const sub = mat[st];
  if (!sub) return null;

  return sub[colorUpper] || null;
}

module.exports = {
  getBambuVariantId,
  bambuCatalog
};
