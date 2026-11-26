import { useEffect } from 'react';
import axios from 'axios';
import useResource from '../../hooks/useResource';
import { useSocket } from '../../contexts/SocketContext';

async function loadAll() {
  const [spools, brands, materials, analytics, knowledge, ams, assignments, settings, printers] = await Promise.all([
    axios.get('/api/spools'),
    axios.get('/api/brands'),
    axios.get('/api/materials'),
    axios.get('/api/analytics'),
    axios.get('/api/knowledge/brands'),
    axios.get('/api/ams'),
    axios.get('/api/ams/assignments'),
    axios.get('/api/settings'),
    axios.get('/api/printers'),
  ]);
  // Total consumed counts each print once, even when it used several spools.
  const seen = new Set();
  const totalConsumed = (analytics.data || []).reduce((acc, print) => {
    if (seen.has(print.id)) return acc;
    seen.add(print.id);
    return acc + (print.filament_used_g || 0);
  }, 0);
  return {
    spools: spools.data || [],
    brands: brands.data || [],
    materials: materials.data || [],
    knowledge: knowledge.data || [],
    totalConsumed,
    ams: ams.data,
    assignments: assignments.data || {},
    settings: settings.data || {},
    printers: printers.data?.printers || [],
  };
}

/** Spools, lists and AMS locations for the Spools screen, kept live by the socket. */
export default function useSpoolData() {
  const socket = useSocket();
  const resource = useResource(loadAll);
  const { setData, reload } = resource;

  useEffect(() => {
    if (!socket) return undefined;
    const patch = (fn) => setData((d) => (d ? { ...d, ...fn(d) } : d));
    const handlers = {
      ams_update: (msg) => patch(() => ({ ams: msg })),
      ams_assignments_update: (msg) => patch(() => ({ assignments: msg || {} })),
      spool_updated: (spool) => {
        if (spool?.id) patch((d) => ({ spools: d.spools.map((s) => (s.id === spool.id ? { ...s, ...spool } : s)) }));
      },
      spool_added: () => reload(),
      spool_deleted: ({ id }) => patch((d) => ({ spools: d.spools.filter((s) => s.id !== id) })),
    };
    Object.entries(handlers).forEach(([e, fn]) => socket.on(e, fn));
    return () => Object.entries(handlers).forEach(([e, fn]) => socket.off(e, fn));
  }, [socket, setData, reload]);

  return resource;
}
