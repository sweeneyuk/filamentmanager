import { Pencil, ShoppingCart, Scissors, Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';

/** Edit and restock stay visible; the rarer actions sit in a menu. */
export default function SpoolActions({ view, actions, onEdit }) {
  const { spool } = view;
  return (
    <div className="sp-actions">
      <Button variant="ghost" icon={Pencil} label={`Edit spool ${spool.id}`} onClick={() => onEdit(spool)} />
      {view.restock && (
        <Button
          variant="ghost"
          className="sp-restock"
          icon={ShoppingCart}
          label={`Restock spool ${spool.id}`}
          href={view.restock}
          target="_blank"
          rel="noreferrer"
        />
      )}
      <Menu
        label={`More actions for spool ${spool.id}`}
        items={[
          { id: 'deduct', label: 'Deduct', icon: Scissors, onSelect: () => actions.deduct(spool) },
          spool.archived
            ? { id: 'restore', label: 'Restore', icon: ArchiveRestore, onSelect: () => actions.toggleArchive(spool) }
            : { id: 'archive', label: 'Archive', icon: Archive, onSelect: () => actions.toggleArchive(spool) },
          { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => actions.remove(spool) },
        ]}
      />
    </div>
  );
}
