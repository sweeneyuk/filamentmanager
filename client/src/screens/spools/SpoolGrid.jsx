import SpoolCard from './SpoolCard';

export default function SpoolGrid({ views, selected, onToggle, actions, onEdit }) {
  return (
    <div className="sp-grid">
      {views.map((v) => (
        <SpoolCard key={v.id} large view={v} selected={selected.includes(v.id)} onToggle={onToggle} actions={actions} onEdit={onEdit} />
      ))}
    </div>
  );
}
