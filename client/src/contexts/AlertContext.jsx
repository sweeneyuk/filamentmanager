import { createContext, useCallback, useContext, useId, useRef, useState } from 'react';
import Dialog from '../ui/Dialog';
import Button from '../ui/Button';
import { useToast } from '../ui/toastContext';

const AlertContext = createContext(null);

export const useAlert = () => useContext(AlertContext);

let nextId = 1;

/**
 * showAlert(title, message, isError = false, options): errors and options.dialog open a dialog,
 * other messages become a toast. showConfirm and showPrompt keep their old signatures.
 */
export const AlertProvider = ({ children }) => {
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const modalRef = useRef(null);
  modalRef.current = modal;

  const open = useCallback((next) => setModal({ id: nextId++, ...next }), []);

  const showAlert = useCallback((title, message, isError = false, options = {}) => {
    if (isError || options.dialog) {
      open({ type: 'alert', title, message, isError });
    } else {
      toast({ title, message });
    }
  }, [open, toast]);

  const showConfirm = useCallback((title, message, onConfirm, isError = false) => {
    open({ type: 'confirm', title, message, onConfirm, isError });
  }, [open]);

  const showPrompt = useCallback((title, message, defaultValue, onConfirm) => {
    open({ type: 'prompt', title, message, onConfirm, isError: false, inputValue: defaultValue || '' });
  }, [open]);

  const closeModal = useCallback(() => setModal(null), []);

  // Close first, then run the action, so a dialog opened by the action stays open.
  const handleConfirm = useCallback(() => {
    const current = modalRef.current;
    if (!current) return;
    setModal(null);
    if (current.onConfirm) {
      if (current.type === 'prompt') current.onConfirm(current.inputValue);
      else current.onConfirm();
    }
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      <AlertDialog modal={modal} onClose={closeModal} onConfirm={handleConfirm} setModal={setModal} />
    </AlertContext.Provider>
  );
};

function AlertDialog({ modal, onClose, onConfirm, setModal }) {
  const inputId = useId();
  const asks = modal && (modal.type === 'confirm' || modal.type === 'prompt');
  const footer = modal && (
    <>
      {asks && <Button variant="outline" onClick={onClose}>Cancel</Button>}
      <Button
        variant={modal.isError && modal.type === 'confirm' ? 'danger' : asks ? 'primary' : 'secondary'}
        type={modal.type === 'prompt' ? 'submit' : 'button'}
        form={modal.type === 'prompt' ? `${inputId}-form` : undefined}
        onClick={modal.type === 'prompt' ? undefined : asks ? onConfirm : onClose}
      >
        {asks ? 'Confirm' : 'OK'}
      </Button>
    </>
  );
  return (
    <Dialog
      key={modal?.id}
      open={Boolean(modal)}
      title={modal?.title}
      onClose={onClose}
      footer={footer}
      className={modal?.isError ? 'ui-dialog--error' : ''}
    >
      {modal && (
        <>
          {modal.message && <p id={`${inputId}-msg`}>{modal.message}</p>}
          {modal.type === 'prompt' && (
            <form id={`${inputId}-form`} onSubmit={(e) => { e.preventDefault(); onConfirm(); }}>
              <input
                className="ui-input"
                type="text"
                aria-labelledby={`${inputId}-msg`}
                value={modal.inputValue}
                onChange={(e) => {
                  const value = e.target.value;
                  setModal((m) => (m ? { ...m, inputValue: value } : m));
                }}
                autoFocus
              />
            </form>
          )}
        </>
      )}
    </Dialog>
  );
}
