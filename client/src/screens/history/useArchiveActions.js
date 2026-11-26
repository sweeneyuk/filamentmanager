import { useCallback, useRef } from 'react';
import axios from 'axios';
import { useAlert } from '../../contexts/AlertContext';

/** Archive actions with the requests and confirmations of the old Archive screen. */
export default function useArchiveActions({ reload, clearSelection }) {
  const { showAlert, showConfirm } = useAlert();
  const fileRef = useRef(null);
  const target = useRef({ id: null, type: null });

  const regenerate = useCallback(async (id, source) => {
    try {
      showAlert('Processing', `Extracting image from ${source}...`, false);
      const res = await axios.post(`/api/archives/${id}/regenerate-image`, { source });
      if (res.data.success) {
        showAlert('Success', 'Image regenerated successfully!');
        reload();
      }
    } catch (err) {
      showAlert('Error', err.response?.data?.error || err.message, true);
    }
  }, [reload, showAlert]);

  const upload = useCallback((id, type) => {
    target.current = { id, type };
    const input = fileRef.current;
    if (!input) return;
    input.value = '';
    input.accept = type === 'photo' ? 'image/*' : 'video/*';
    input.click();
  }, []);

  const onFile = useCallback(async (file) => {
    const { id, type } = target.current;
    if (!file || !id) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    try {
      showAlert('Uploading', `Uploading custom ${type}...`, false);
      const res = await axios.post(`/api/archives/${id}/media`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.success) {
        showAlert('Success', `${type} uploaded successfully!`);
        reload();
      }
    } catch (err) {
      showAlert('Error', err.response?.data?.error || err.message, true);
    }
    target.current = { id: null, type: null };
  }, [reload, showAlert]);

  const deleteMedia = useCallback((id, type) => {
    showConfirm(`Delete ${type}?`, `Are you sure you want to delete the custom ${type} for this print?`, async () => {
      try {
        await axios.delete(`/api/archives/${id}/media/${type}`);
        reload();
        showAlert('Success', `${type} deleted.`);
      } catch (err) {
        showAlert('Error', `Failed to delete media: ${err.message}`, true);
      }
    });
  }, [reload, showAlert, showConfirm]);

  const remove = useCallback((id, onDone) => {
    showConfirm('Delete Archive?', 'Are you sure you want to delete this archived print? This will also permanently delete the associated timelapse video and photos from the server. This action cannot be undone.', async () => {
      try {
        await axios.delete(`/api/archives/${id}`);
        onDone?.();
        reload();
      } catch (err) {
        showAlert('Error', `Failed to delete archive: ${err.message}`, true);
      }
    }, true);
  }, [reload, showAlert, showConfirm]);

  const bulkDelete = useCallback((ids) => {
    showConfirm('Delete Selected Archives?', `Are you sure you want to delete ${ids.length} archived print(s)? This will also permanently delete the associated timelapse videos and photos from the server. This action cannot be undone.`, async () => {
      try {
        for (const id of ids) {
          await axios.delete(`/api/archives/${id}`); // eslint-disable-line no-await-in-loop
        }
        clearSelection();
        reload();
      } catch (err) {
        showAlert('Error', `Failed to delete some archives: ${err.message}`, true);
      }
    }, true);
  }, [clearSelection, reload, showAlert, showConfirm]);

  return { fileRef, onFile, regenerate, upload, deleteMedia, remove, bulkDelete };
}
