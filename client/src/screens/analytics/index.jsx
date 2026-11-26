import { useEffect } from 'react';
import axios from 'axios';
import PageHeader from '../../ui/shell/PageHeader';
import Card from '../../ui/Card';
import StatTile from '../../ui/StatTile';
import FilamentDot from '../../ui/FilamentDot';
import EmptyState from '../../ui/EmptyState';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import useResource from '../../hooks/useResource';
import useSettings from '../../hooks/useSettings';
import { useSocket } from '../../contexts/SocketContext';
import { summariseAnalytics } from '../../lib/analytics.js';
import { colorName } from '../../lib/colors.js';
import BarList from './BarList';
import SuccessDonut from './SuccessDonut';
import './analytics.css';

export default function Analytics() {
  const socket = useSocket();
  const { money } = useSettings();
  const { data, status, reload } = useResource(async () => (await axios.get('/api/analytics')).data || []);

  useEffect(() => {
    if (!socket) return undefined;
    socket.on('archive_updated', reload);
    socket.on('archive_deleted', reload);
    return () => {
      socket.off('archive_updated', reload);
      socket.off('archive_deleted', reload);
    };
  }, [socket, reload]);

  const s = summariseAnalytics(data || []);

  return (
    <>
      <PageHeader title="Analytics" />
      {status === 'loading' && <Skeleton height={140} count={3} />}
      {status === 'error' && <LoadError message="Could not load analytics." onRetry={reload} />}
      {status === 'ready' && s.totalPrints === 0 && <EmptyState title="No finished prints yet. Analytics appear after your first print." />}
      {status === 'ready' && s.totalPrints > 0 && (
        <>
          <div className="an-tiles">
            <StatTile label="Total prints" value={s.totalPrints} />
            <StatTile label="Filament used" value={`${(s.totalWeightG / 1000).toFixed(2)} kg`} />
            <StatTile label="Total cost" value={money(s.totalCost)} sub={`Filament: ${money(s.totalFilamentCost)}`} />
            <StatTile label="Energy cost" value={money(s.totalEnergyCost)} />
          </div>
          <div className="an-grid">
            <Card className="an-card" aria-label="Filament by material">
              <h2>Filament by material</h2>
              {s.materials.length ? <BarList items={s.materials.map((m) => ({ name: m.name, value: m.grams }))} format={(v) => `${v.toFixed(1)} g`} />
                : <p className="ui-muted">No print data available.</p>}
            </Card>
            <Card className="an-card" aria-label="Success rate">
              <h2>Success rate</h2>
              {s.success + s.failure > 0 ? <SuccessDonut success={s.success} failure={s.failure} />
                : <p className="ui-muted">No AI analysis data available.</p>}
            </Card>
            <Card className="an-card" aria-label="Failure types">
              <h2>Failure types</h2>
              {s.failureTypes.length ? <BarList items={s.failureTypes.map((f) => ({ name: f.name, value: f.count }))} format={(v) => String(v)} />
                : <p className="ui-muted">No failures recorded.</p>}
            </Card>
          </div>
          {s.problemSpools.length > 0 && (
            <Card className="an-card" aria-label="Problem filament">
              <h2>Problem filament</h2>
              <p className="ui-muted">Highest failure rates in AI-analysed prints.</p>
              <ul className="an-problems">
                {s.problemSpools.map((p) => (
                  <li key={p.key}>
                    <FilamentDot color={p.color} />
                    <span className="an-problems__name">{p.name}{p.color ? `, ${colorName({ color: p.color }).toLowerCase()}` : ''}</span>
                    <span className="an-problems__rate">{p.rate}% ({p.fails} of {p.total})</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </>
  );
}
