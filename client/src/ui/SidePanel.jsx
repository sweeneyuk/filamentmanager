import { useId } from 'react';
import { X } from 'lucide-react';
import Button from './Button';
import useNativeDialog from './useNativeDialog';
import './SidePanel.css';

export default function SidePanel({ open, title, onClose, footer, className = '', children }) {
  const { ref, handlers } = useNativeDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog ref={ref} aria-labelledby={titleId} className={`ui-panel ${className}`.trim()} {...handlers}>
      {open && (
        <div className="ui-panel__inner">
          <header className="ui-panel__head">
            <h2 id={titleId} className="ui-panel__title">{title}</h2>
            <Button variant="ghost" icon={X} label="Close" onClick={onClose} />
          </header>
          <div className="ui-panel__body">{children}</div>
          {footer && <footer className="ui-panel__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
