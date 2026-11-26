import { useCallback, useEffect } from 'react';
import axios from 'axios';
import useResource from '../../hooks/useResource';
import { useSocket } from '../../contexts/SocketContext';
import { useAlert } from '../../contexts/AlertContext';
import { unitName } from '../../lib/ams.js';

async function loadAll() {
  const [printersRes, amsRes, assignRes, spoolsRes, printRes, settingsRes] = await Promise.all([
    axios.get('/api/printers'),
    axios.get('/api/ams'),
    axios.get('/api/ams/assignments'),
    axios.get('/api/spools'),
    axios.get('/api/print_status'),
    axios.get('/api/settings'),
  ]);
  return {
    printers: printersRes.data?.printers || [],
    amsByPrinter: amsRes.data || {},
    assignments: assignRes.data || {},
    spools: (spoolsRes.data || []).filter((s) => !s.archived),
    states: printRes.data || {},
    settings: settingsRes.data || {},
  };
}

/** Printer, AMS and spool data for Print status, kept live by the socket (rules from the old PrintStatus). */
export default function usePrinterData() {
  const socket = useSocket();
  const { showAlert, showPrompt } = useAlert();
  const { data, status, reload, setData } = useResource(loadAll);

  useEffect(() => {
    if (!socket) return undefined;
    const patch = (fn) => setData((d) => (d ? { ...d, ...fn(d) } : d));

    const onState = (msg) => patch((d) => ({ states: { ...d.states, [msg.printer_id]: msg.state } }));
    const onAms = (msg) => patch((d) => ({ amsByPrinter: { ...d.amsByPrinter, [msg.printer_id]: msg.ams } }));
    const onAssignments = (msg) => patch(() => ({ assignments: msg || {} }));
    const onTakeover = (msg) => showAlert('Spool Takeover',
      `Auto-Refill: Switched from slot ${msg.from_tray} to slot ${msg.to_tray} at ${msg.progress}% progress!`, false, { dialog: true });
    const onRunout = (msg) => showAlert('Filament Runout',
      `Spool in slot ${msg.tray_id} ran out of filament at ${msg.progress}%!`, true, { dialog: true });
    const onSpoolUpdated = (spool) => {
      if (!spool?.id) return;
      patch((d) => {
        if (spool.archived) return { spools: d.spools.filter((s) => s.id !== spool.id) };
        const exists = d.spools.some((s) => s.id === spool.id);
        return {
          spools: exists ? d.spools.map((s) => (s.id === spool.id ? { ...s, ...spool } : s)) : [spool, ...d.spools],
        };
      });
    };
    const onSpoolAdded = (spool) => {
      if (!spool?.id || spool.archived) return;
      patch((d) => ({ spools: d.spools.some((s) => s.id === spool.id) ? d.spools : [spool, ...d.spools] }));
    };
    const onSpoolDeleted = ({ id }) => patch((d) => ({ spools: d.spools.filter((s) => s.id !== id) }));

    const handlers = {
      print_state_update: onState,
      ams_update: onAms,
      ams_assignments_update: onAssignments,
      spool_takeover: onTakeover,
      spool_runout: onRunout,
      spool_updated: onSpoolUpdated,
      spool_added: onSpoolAdded,
      spool_deleted: onSpoolDeleted,
    };
    Object.entries(handlers).forEach(([event, fn]) => socket.on(event, fn));
    return () => Object.entries(handlers).forEach(([event, fn]) => socket.off(event, fn));
  }, [socket, setData, showAlert]);

  const assign = useCallback(async (printerId, trayId, spoolId) => {
    try {
      await axios.post('/api/ams/assignments', { printer_id: printerId, tray_id: trayId, spool_id: spoolId });
      reload();
      return true;
    } catch {
      showAlert('Error', 'Failed to assign spool to AMS', true);
      return false;
    }
  }, [reload, showAlert]);

  const renameUnit = useCallback((printerId, unitId) => {
    const defaultName = unitName({}, printerId, unitId);
    const key = `ams_name_${printerId}_${unitId}`;
    const currentName = data?.settings?.[key] || defaultName;
    showPrompt(`Rename ${defaultName}`, 'Enter a new name for this AMS (or clear to reset):', currentName, async (newName) => {
      if (newName === null || newName === undefined) return;
      try {
        await axios.post('/api/settings', { [key]: newName.trim() });
        reload();
      } catch {
        showAlert('Error', 'Failed to rename AMS', true);
      }
    });
  }, [data, reload, showAlert, showPrompt]);

  return {
    status,
    reload,
    printers: data?.printers || [],
    amsByPrinter: data?.amsByPrinter || {},
    assignments: data?.assignments || {},
    spools: data?.spools || [],
    states: data?.states || {},
    settings: data?.settings || {},
    assign,
    renameUnit,
  };
}
