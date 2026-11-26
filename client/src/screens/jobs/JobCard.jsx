import { Pencil, Trash2 } from 'lucide-react';
import Button from '../../ui/Button';
import StatusPill from '../../ui/StatusPill';
import { STATUS_TONE } from './statuses';

const dateOf = (v) => {
  const d = v ? new Date(String(v).replace(' ', 'T')) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-GB') : '';
};

export default function JobCard({ job, money, onEdit, onDelete }) {
  const name = job.project_name || `Job ${job.id}`;
  return (
    <article className="jo-card" aria-label={name}>
      <div className="jo-card__head">
        <div className="jo-card__title">
          <h2>{name}</h2>
          {job.customer_name && <span className="ui-muted">{job.customer_name}</span>}
        </div>
        <StatusPill tone={STATUS_TONE[job.status] || 'neutral'}>{job.status}</StatusPill>
      </div>
      <dl className="jo-card__money">
        <div><dt>Total cost</dt><dd>{money(job.total_cost)}</dd></div>
        <div><dt>Markup</dt><dd>+{money(job.markup_amount)}</dd></div>
        <div className="is-final"><dt>Final price</dt><dd>{money(job.final_price)}</dd></div>
      </dl>
      {job.notes && <p className="jo-card__notes">{job.notes}</p>}
      <div className="jo-card__foot">
        <span className="ui-muted">#{job.id}, {dateOf(job.created_at)}</span>
        <div>
          <Button variant="ghost" icon={Pencil} label={`Edit ${name}`} onClick={() => onEdit(job)} />
          <Button variant="ghost" icon={Trash2} label={`Delete ${name}`} onClick={() => onDelete(job)} />
        </div>
      </div>
    </article>
  );
}
