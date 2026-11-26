import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import PageHeader from '../../ui/shell/PageHeader';
import Button from '../../ui/Button';
import StatusPill from '../../ui/StatusPill';
import EmptyState from '../../ui/EmptyState';
import Skeleton from '../../ui/Skeleton';
import LoadError from '../../ui/LoadError';
import usePrinterData from './usePrinterData';
import PrinterSection from './PrinterSection';
import { phaseOf } from './phase';
import './print-status.css';

export default function PrintStatus() {
  const data = usePrinterData();
  const { status, reload, printers, states } = data;
  const single = printers.length === 1 ? printers[0] : null;
  const singleState = single ? states[single.id] : null;
  const phase = singleState ? phaseOf(singleState) : null;

  return (
    <>
      <PageHeader
        title={single ? single.name : 'Print status'}
        status={phase && <StatusPill tone={phase.tone}>{phase.label}</StatusPill>}
        actions={<Button variant="outline" icon={RefreshCw} label="Refresh" onClick={reload} />}
      />
      {status === 'loading' && <Skeleton height={260} count={2} />}
      {status === 'error' && <LoadError message="Could not load printer status." onRetry={reload} />}
      {status === 'ready' && printers.length === 0 && (
        <EmptyState
          title="No printers configured. Add your first printer in Settings."
          action={<Link className="ui-btn ui-btn--primary" to="/settings">Settings</Link>}
        />
      )}
      {status === 'ready' && printers.map((p) => (
        <PrinterSection key={p.id} printer={p} data={data} showHeading={!single} />
      ))}
    </>
  );
}
