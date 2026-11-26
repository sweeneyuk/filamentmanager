import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import PageHeader from '../../ui/shell/PageHeader';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import useResource from '../../hooks/useResource';
import useSettings from '../../hooks/useSettings';
import { useSocket } from '../../contexts/SocketContext';
import useArchiveActions from './useArchiveActions';
import HistoryCard from './HistoryCard';
import DetailsPanel from './DetailsPanel';
import MediaViewer from './MediaViewer';
import './history.css';

const readToken = () => { try { return localStorage.getItem('token'); } catch { return null; } };

export default function History() {
  const socket = useSocket();
  const { money } = useSettings();
  const { data, status, reload, setData } = useResource(async () => (await axios.get('/api/archives')).data || []);
  const archives = data || [];
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [media, setMedia] = useState(null);
  const token = readToken();

  const clearSelection = useCallback(() => setSelected([]), []);
  const actions = useArchiveActions({ reload, clearSelection });

  useEffect(() => {
    if (!socket) return undefined;
    const onUpdated = (arch) => {
      if (!arch?.id) return;
      setData((list = []) => (list.some((a) => a.id === arch.id) ? list.map((a) => (a.id === arch.id ? arch : a)) : [arch, ...list]));
    };
    const onDeleted = ({ id }) => {
      setData((list = []) => list.filter((a) => a.id !== id));
      setSelected((ids) => ids.filter((x) => x !== id));
    };
    socket.on('archive_updated', onUpdated);
    socket.on('archive_deleted', onDeleted);
    return () => {
      socket.off('archive_updated', onUpdated);
      socket.off('archive_deleted', onDeleted);
    };
  }, [socket, setData]);

  const toggle = (id) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  const allSelected = archives.length > 0 && selected.length === archives.length;
  const open = archives.find((a) => a.id === openId) || null;

  return (
    <>
      <PageHeader title="Print history" />
      <input ref={actions.fileRef} type="file" hidden onChange={(e) => actions.onFile(e.target.files[0])} />

      {selected.length > 0 && (
        <section className="hi-bulk" aria-label="Selected prints">
          <strong>{selected.length} selected</strong>
          <div className="hi-bulk__actions">
            <Button variant="outline" onClick={() => setSelected(allSelected ? [] : archives.map((a) => a.id))}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Button>
            <Button variant="danger" onClick={() => actions.bulkDelete(selected)}>Delete selected</Button>
          </div>
        </section>
      )}

      {status === 'loading' && <Skeleton height={300} count={2} />}
      {status === 'error' && <LoadError message="Could not load print history." onRetry={reload} />}
      {status === 'ready' && archives.length === 0 && <EmptyState title="No prints archived yet. Finished prints appear here." />}
      {status === 'ready' && archives.length > 0 && (
        <div className="hi-grid">
          {archives.map((arch) => (
            <HistoryCard
              key={arch.id}
              arch={arch}
              token={token}
              selected={selected.includes(arch.id)}
              onToggle={toggle}
              onOpen={setOpenId}
              onView={setMedia}
              actions={actions}
              money={money}
            />
          ))}
        </div>
      )}

      <DetailsPanel arch={open} token={token} money={money} onClose={() => setOpenId(null)} />
      <MediaViewer media={media} onClose={() => setMedia(null)} />
    </>
  );
}
