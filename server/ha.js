const axios = require('axios');
const { db } = require('./database');

// Helper to get settings
const getSetting = (key) => {
  return new Promise((resolve, reject) => {
    db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.value : null);
    });
  });
};

const getHaState = async (entityId) => {
  const url = await getSetting('ha_url');
  const token = await getSetting('ha_token');

  if (!url || !token || !entityId) {
    return null;
  }

  try {
    const response = await axios.get(`${url.replace(/\/$/, '')}/api/states/${entityId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 5000,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching HA state for ${entityId}:`, error.message);
    return null;
  }
};

const getEnergyRate = async () => {
  const source = await getSetting('energy_rate_source');
  
  if (source === 'manual') {
    const manualRate = await getSetting('manual_energy_rate');
    return manualRate && !isNaN(parseFloat(manualRate)) ? parseFloat(manualRate) : 0;
  }

  // Default to Home Assistant
  const entityId = await getSetting('ha_rate_entity');
  if (!entityId) return 0;
  const state = await getHaState(entityId);
  return state && !isNaN(parseFloat(state.state)) ? parseFloat(state.state) : 0;
};

const getPrinterEnergyUsage = async () => {
  const entityId = await getSetting('ha_energy_entity');
  if (!entityId) return 0;
  const state = await getHaState(entityId);
  // Returns total kWh if it's an energy entity, or W if it's a power entity.
  // We assume the user configures an energy entity (kWh) that tracks cumulative energy.
  return state && !isNaN(parseFloat(state.state)) ? parseFloat(state.state) : 0;
};

module.exports = {
  getHaState,
  getEnergyRate,
  getPrinterEnergyUsage
};
