import { Camera, Video, Upload, Trash2, Play, Image as ImageIcon } from 'lucide-react';
import Menu from '../../ui/Menu';
import Button from '../../ui/Button';
import StatusPill from '../../ui/StatusPill';
import FilamentDot from '../../ui/FilamentDot';
import { formatDuration } from '../../lib/format.js';
import { mediaUrl } from '../../lib/media.js';
import { statusPill, printedAt } from './status';

export default function HistoryCard({ arch, token, selected, onToggle, onOpen, onView, actions, money }) {
  const name = arch.print_name || `Print ${arch.id}`;
  const pill = statusPill(arch.status);
  const thumb = mediaUrl(arch.thumbnail_path, token);
  const photo = mediaUrl(arch.photo_path || arch.thumbnail_path, token);
  return (
    <article className={`hi-card ${selected ? 'is-selected' : ''}`} aria-label={name}>
      <div className="hi-card__media">
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <span className="hi-card__none">No image</span>}
        <label className="hi-card__check">
          <input type="checkbox" aria-label={`Select ${name}`} checked={selected} onChange={() => onToggle(arch.id)} />
        </label>
        <div className="hi-card__media-actions">
          {photo && <Button variant="secondary" icon={ImageIcon} label="View photo" onClick={() => onView({ kind: 'photo', src: photo, name })} />}
          {arch.timelapse_path && (
            <Button variant="secondary" icon={Play} label="Play timelapse" onClick={() => onView({ kind: 'video', src: mediaUrl(arch.timelapse_path, token), name })} />
          )}
        </div>
      </div>
      <div className="hi-card__body">
        <div className="hi-card__top">
          <button type="button" className="hi-card__open" aria-label={`Open ${name}`} onClick={() => onOpen(arch.id)}>
            <span className="hi-card__name">{name}</span>
          </button>
          <Menu
            label={`More actions for ${name}`}
            items={[
              { id: 'live', label: 'Fetch live camera', icon: Camera, onSelect: () => actions.regenerate(arch.id, 'live') },
              { id: 'timelapse', label: 'Extract from timelapse', icon: Video, onSelect: () => actions.regenerate(arch.id, 'timelapse') },
              { id: 'up-photo', label: 'Upload photo', icon: Upload, onSelect: () => actions.upload(arch.id, 'photo') },
              { id: 'up-video', label: 'Upload video', icon: Upload, onSelect: () => actions.upload(arch.id, 'video') },
              arch.photo_path && { id: 'del-photo', label: 'Delete photo', icon: Trash2, danger: true, onSelect: () => actions.deleteMedia(arch.id, 'photo') },
              arch.timelapse_path && { id: 'del-video', label: 'Delete video', icon: Trash2, danger: true, onSelect: () => actions.deleteMedia(arch.id, 'video') },
              { id: 'delete', label: 'Delete', icon: Trash2, danger: true, onSelect: () => actions.remove(arch.id) },
            ]}
          />
        </div>
        <div className="hi-card__meta">
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
          <span>{printedAt(arch.created_at)}</span>
          <span>{formatDuration(arch.duration_seconds)}</span>
        </div>
        <ul className="hi-card__spools">
          {(arch.spools_used || []).length === 0 && <li className="ui-muted">No filament recorded</li>}
          {(arch.spools_used || []).map((s, i) => (
            <li key={i}>
              <FilamentDot color={s.color} size={12} />
              <span>{s.brand} {s.material}</span>
              {Number.isFinite(s.weight_used_g) && <span className="ui-muted">{s.weight_used_g.toFixed(1)} g</span>}
            </li>
          ))}
        </ul>
        <div className="hi-card__cost">{money(arch.total_cost)}</div>
      </div>
    </article>
  );
}
