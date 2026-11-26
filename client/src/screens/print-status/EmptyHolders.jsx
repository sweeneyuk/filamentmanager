import Button from '../../ui/Button';

export default function EmptyHolders({ units, onAssign }) {
  if (!units.length) return null;
  const many = units.length > 1;
  return (
    <div className="ps-holders">
      <span>{many ? `${units.length} external spool holders are empty.` : '1 external spool holder is empty.'}</span>
      {units.map((u, i) => (
        <Button
          key={u.id}
          variant="outline"
          aria-label={many ? `Assign external spool, holder ${i + 1}` : 'Assign external spool'}
          onClick={() => onAssign(u.id)}
        >
          Assign external spool{many ? ` ${i + 1}` : ''}
        </Button>
      ))}
    </div>
  );
}
