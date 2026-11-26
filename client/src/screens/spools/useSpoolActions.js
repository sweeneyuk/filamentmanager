import { useCallback } from 'react';
import axios from 'axios';
import { useAlert } from '../../contexts/AlertContext';
import { restockUrl } from '../../lib/spools.js';

/** Spool actions with the same requests, prompts and confirmations as the old FilamentManager. */
export default function useSpoolActions({ spools, settings, reload, clearSelection }) {
  const { showAlert, showConfirm, showPrompt } = useAlert();

  const deduct = useCallback((spool) => {
    showPrompt('Deduct Filament', `Enter amount in grams to deduct from ${spool.brand_name} ${spool.material_name}:`, '', async (val) => {
      if (!val) return;
      const amount = parseFloat(val);
      if (Number.isNaN(amount) || amount <= 0) {
        showAlert('Invalid Amount', 'Please enter a valid positive number.', true);
        return;
      }
      try {
        await axios.post(`/api/spools/${spool.id}/deduct`, { amount });
        reload();
        showAlert('Success', `Deducted ${amount}g from spool.`);
      } catch {
        showAlert('Error', 'Failed to deduct from spool.', true);
      }
    });
  }, [reload, showAlert, showPrompt]);

  const toggleArchive = useCallback(async (spool) => {
    try {
      await axios.put(`/api/spools/${spool.id}/archive`, { archived: !spool.archived });
      reload();
    } catch {
      showAlert('Error', 'Failed to update archive status', true);
    }
  }, [reload, showAlert]);

  const remove = useCallback((spool) => {
    showConfirm('Delete Spool', 'Are you sure you want to delete this spool? This cannot be undone.', async () => {
      try {
        await axios.delete(`/api/spools/${spool.id}`);
        clearSelection([spool.id]);
        reload();
      } catch {
        showAlert('Error', 'Failed to delete spool', true);
      }
    }, true);
  }, [clearSelection, reload, showAlert, showConfirm]);

  const restock = useCallback((spool) => restockUrl(spool, settings), [settings]);

  const bulk = useCallback((action, ids) => {
    if (!ids.length) return;
    if (action === 'delete') {
      showConfirm('Delete Selected', `Are you sure you want to delete ${ids.length} spools? This cannot be undone.`, async () => {
        try {
          await Promise.all(ids.map((id) => axios.delete(`/api/spools/${id}`)));
          clearSelection();
          reload();
          showAlert('Success', 'Selected spools deleted successfully.');
        } catch {
          showAlert('Error', 'Failed to delete some spools.', true);
        }
      }, true);
    } else if (action === 'archive' || action === 'unarchive') {
      const archived = action === 'archive';
      (async () => {
        try {
          await Promise.all(ids.map((id) => axios.put(`/api/spools/${id}/archive`, { archived })));
          clearSelection();
          reload();
        } catch {
          showAlert('Error', `Failed to ${action} spools.`, true);
        }
      })();
    } else if (action === 'location') {
      showPrompt('Update Location', 'Enter new location for selected spools (e.g. Shelf B):', '', async (newLoc) => {
        if (!newLoc) return;
        try {
          await Promise.all(ids.map(async (id) => {
            const spool = spools.find((s) => s.id === id);
            if (spool) await axios.put(`/api/spools/${id}`, { ...spool, location: newLoc });
          }));
          clearSelection();
          reload();
        } catch {
          showAlert('Error', 'Failed to update locations.', true);
        }
      });
    }
  }, [clearSelection, reload, showAlert, showConfirm, showPrompt, spools]);

  const importCsv = useCallback(async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('csvFile', file);
    try {
      await axios.post('/api/import/csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      showAlert('Success', 'CSV imported successfully!');
      reload();
    } catch (err) {
      showAlert('Error', `Failed to import CSV: ${err.response?.data?.error || err.message}`, true);
    }
  }, [reload, showAlert]);

  const exportCsv = useCallback(() => {
    window.location.href = '/api/export/csv';
  }, []);

  return { deduct, toggleArchive, remove, restock, bulk, importCsv, exportCsv };
}
