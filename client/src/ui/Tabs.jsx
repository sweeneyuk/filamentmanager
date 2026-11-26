import { useRef } from 'react';
import './Tabs.css';

export default function Tabs({ label, items, value, onChange, idPrefix = 'tab', panelId }) {
  const refs = useRef({});
  const onKeyDown = (e) => {
    const i = items.findIndex((it) => it.id === value);
    let next = null;
    if (e.key === 'ArrowRight') next = items[(i + 1) % items.length];
    if (e.key === 'ArrowLeft') next = items[(i - 1 + items.length) % items.length];
    if (e.key === 'Home') next = items[0];
    if (e.key === 'End') next = items[items.length - 1];
    if (next) {
      e.preventDefault();
      onChange(next.id);
      refs.current[next.id]?.focus();
    }
  };
  return (
    <div className="ui-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((it) => (
        <button
          key={it.id}
          ref={(el) => { refs.current[it.id] = el; }}
          type="button"
          role="tab"
          id={`${idPrefix}-${it.id}`}
          aria-selected={it.id === value}
          aria-controls={panelId || `${idPrefix}-${it.id}-panel`}
          tabIndex={it.id === value ? 0 : -1}
          className={`ui-tab ${it.id === value ? 'is-active' : ''}`}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
