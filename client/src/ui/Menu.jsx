import { useId, useLayoutEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import Button from './Button';
import './Menu.css';

/** Action menu in the top layer (popover), so cards and tables cannot clip it. */
export default function Menu({ label, items, icon = MoreHorizontal, trigger, align = 'end' }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const visible = items.filter(Boolean);

  const place = () => {
    const t = triggerRef.current?.getBoundingClientRect();
    const m = menuRef.current;
    if (!t || !m) return;
    const width = m.offsetWidth;
    const height = m.offsetHeight;
    let left = align === 'end' ? t.right - width : t.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    let top = t.bottom + 6;
    if (top + height > window.innerHeight - 8) top = Math.max(8, t.top - height - 6);
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;
  };

  useLayoutEffect(() => {
    const m = menuRef.current;
    if (!m) return undefined;
    if (open) {
      if (!m.matches(':popover-open')) m.showPopover();
      place();
      m.querySelector('[role="menuitem"]:not([disabled])')?.focus();
      const onScroll = () => setOpen(false);
      window.addEventListener('resize', onScroll);
      document.addEventListener('scroll', onScroll, true);
      return () => {
        window.removeEventListener('resize', onScroll);
        document.removeEventListener('scroll', onScroll, true);
      };
    }
    if (m.matches(':popover-open')) m.hidePopover();
    return undefined;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e) => {
    const nodes = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = nodes.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); nodes[(i + 1) % nodes.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); nodes[(i - 1 + nodes.length) % nodes.length]?.focus(); }
    if (e.key === 'Home') { e.preventDefault(); nodes[0]?.focus(); }
    if (e.key === 'End') { e.preventDefault(); nodes[nodes.length - 1]?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') close(false);
  };

  const TriggerIcon = icon;
  return (
    <>
      {trigger ? trigger({ ref: triggerRef, open, toggle: () => setOpen((o) => !o), id })
        : (
          <Button
            ref={triggerRef}
            variant="ghost"
            icon={TriggerIcon}
            label={label}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={`${id}-menu`}
            onClick={() => setOpen((o) => !o)}
          />
        )}
      <div
        ref={menuRef}
        id={`${id}-menu`}
        popover="auto"
        role="menu"
        aria-label={label}
        className="ui-menu"
        onKeyDown={onKeyDown}
        onToggle={(e) => { if (e.newState === 'closed' && open) setOpen(false); }}
      >
        {visible.map((it) => {
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={`ui-menu__item ${it.danger ? 'is-danger' : ''}`}
              onClick={() => { close(); it.onSelect?.(); }}
            >
              {Icon && <Icon size={18} aria-hidden="true" />}
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
