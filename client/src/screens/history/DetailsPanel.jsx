import { Download } from 'lucide-react';
import SidePanel from '../../ui/SidePanel';
import StatusPill from '../../ui/StatusPill';
import FilamentDot from '../../ui/FilamentDot';
import { formatDuration } from '../../lib/format.js';
import { mediaUrl } from '../../lib/media.js';
import { statusPill, aiAnalysis, printedAt } from './status';

export default function DetailsPanel({ arch, token, money, onClose }) {
  const name = arch ? arch.print_name || `Print ${arch.id}` : '';
  const pill = arch ? statusPill(arch.status) : null;
  const ai = arch ? aiAnalysis(arch.ai_analysis) : null;
  const photo = arch ? mediaUrl(arch.photo_path || arch.thumbnail_path, token) : null;
  const video = arch ? mediaUrl(arch.timelapse_path, token) : null;
  const kwh = Number(arch?.energy_kwh) || 0;
  return (
    <SidePanel open={Boolean(arch)} title={name} onClose={onClose}>
      {arch && (
        <div className="hi-details">
          <div className="hi-details__meta">
            <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
            <span>{printedAt(arch.created_at)}</span>
            <span>{formatDuration(arch.duration_seconds)}</span>
          </div>
          {photo && (
            <figure className="hi-details__media">
              <img src={photo} alt={`Photo of ${name}`} />
              <a className="ui-btn ui-btn--ghost" href={photo} download><Download size={18} aria-hidden="true" /><span className="ui-btn__text">Download photo</span></a>
            </figure>
          )}
          {video && (
            <figure className="hi-details__media">
              <video src={video} controls playsInline preload="metadata" />
              <a className="ui-btn ui-btn--ghost" href={video} download><Download size={18} aria-hidden="true" /><span className="ui-btn__text">Download timelapse</span></a>
            </figure>
          )}
          <section>
            <h3>Filament</h3>
            <ul className="hi-details__spools">
              {(arch.spools_used || []).length === 0 && <li className="ui-muted">None recorded</li>}
              {(arch.spools_used || []).map((s, i) => (
                <li key={i}>
                  <FilamentDot color={s.color} />
                  <span>{s.brand} {s.material}{s.color_name ? `, ${s.color_name}` : ''}</span>
                  {Number.isFinite(s.weight_used_g) && <span className="ui-muted">{s.weight_used_g.toFixed(1)} g</span>}
                </li>
              ))}
            </ul>
          </section>
          {ai && (
            <section>
              <h3>AI analysis</h3>
              <StatusPill tone={ai.tone}>{ai.status}</StatusPill>
              {ai.reason && <p className="hi-details__reason">{ai.reason}</p>}
            </section>
          )}
          <section>
            <h3>Cost</h3>
            <dl className="hi-details__costs">
              <div><dt>Energy ({kwh.toFixed(3)} kWh)</dt><dd>{money(arch.energy_cost)}</dd></div>
              <div><dt>Filament</dt><dd>{money(arch.filament_cost)}</dd></div>
              <div className="is-total"><dt>Total</dt><dd>{money(arch.total_cost)}</dd></div>
            </dl>
          </section>
        </div>
      )}
    </SidePanel>
  );
}
