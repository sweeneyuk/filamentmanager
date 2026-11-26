import { useId } from 'react';
import useNativeDialog from './useNativeDialog';
import { X } from 'lucide-react';
import Button from './Button';
import './Dialog.css';

export default function Dialog({ open, title, onClose, footer, fullScreenOnPhone = false, size = 'md', className = '', children }) {
  const { ref, handlers } = useNativeDialog(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`ui-dialog ui-dialog--${size} ${fullScreenOnPhone ? 'ui-dialog--phone-full' : ''} ${className}`.trim()}
      {...handlers}
    >
      {open && (
        <div className="ui-dialog__inner">
          <header className="ui-dialog__head">
            <h2 id={titleId} className="ui-dialog__title">{title}</h2>
            {onClose && <Button variant="ghost" icon={X} label="Close" onClick={onClose} />}
          </header>
          <div className="ui-dialog__body">{children}</div>
          {footer && <footer className="ui-dialog__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
