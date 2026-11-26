import { useEffect, useRef } from 'react';

/** Modal built on native <dialog>: focus trap, Escape and focus return come from the browser. */
export default function useNativeDialog(open, onClose) {
  const ref = useRef(null);
  const returnTo = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (open && !el.open) {
      returnTo.current = document.activeElement;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      const target = returnTo.current;
      if (target && target.isConnected && typeof target.focus === 'function') target.focus();
    }
    return undefined;
  }, [open]);
  useEffect(() => () => {
    const target = returnTo.current;
    if (ref.current?.open) ref.current.close();
    if (target && target.isConnected && typeof target.focus === 'function') target.focus();
  }, []);
  const handlers = {
    onCancel: (e) => { e.preventDefault(); onClose?.(); },
    onMouseDown: (e) => { if (e.target === ref.current) e.currentTarget.dataset.backdrop = '1'; },
    onClick: (e) => {
      const fromBackdrop = e.currentTarget.dataset.backdrop === '1';
      delete e.currentTarget.dataset.backdrop;
      if (e.target === ref.current && fromBackdrop) onClose?.();
    },
  };
  return { ref, handlers };
}
