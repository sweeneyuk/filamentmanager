import { useCallback, useEffect, useRef, useState } from 'react';
import { ToastContext } from './toastContext';
import { X } from 'lucide-react';
import './Toast.css';

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const hostRef = useRef(null);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(({ title, message }) => {
    const id = nextId++;
    setToasts((list) => [...list, { id, title, message }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host?.showPopover) return;
    // Re-show so the toasts sit above any dialog opened since.
    if (host.matches(':popover-open')) host.hidePopover();
    if (toasts.length) host.showPopover();
  }, [toasts]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div ref={hostRef} popover="manual" className="ui-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="ui-toast">
            <div className="ui-toast__text">
              {t.title && <strong>{t.title}</strong>}
              {t.message && <span>{t.message}</span>}
            </div>
            <button type="button" className="ui-toast__close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
