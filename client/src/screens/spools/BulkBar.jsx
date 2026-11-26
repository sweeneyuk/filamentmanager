import Button from '../../ui/Button';

export default function BulkBar({ count, onAction, onClear }) {
  if (!count) return null;
  return (
    <section className="sp-bulk" aria-label="Selected spools">
      <strong>{count} {count === 1 ? 'spool' : 'spools'} selected</strong>
      <div className="sp-bulk__actions">
        <Button variant="outline" onClick={() => onAction('location')}>Set location</Button>
        <Button variant="outline" onClick={() => onAction('archive')}>Archive</Button>
        <Button variant="outline" onClick={() => onAction('unarchive')}>Unarchive</Button>
        <Button variant="danger" onClick={() => onAction('delete')}>Delete</Button>
        <Button variant="ghost" onClick={onClear}>Clear</Button>
      </div>
    </section>
  );
}
