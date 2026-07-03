import React, { createContext, useContext, useState, useCallback } from 'react';

const AlertContext = createContext(null);

export const useAlert = () => useContext(AlertContext);

export const AlertProvider = ({ children }) => {
  const [modal, setModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert', // 'alert', 'confirm', or 'prompt'
    onConfirm: null,
    isError: false,
    defaultValue: '',
    inputValue: ''
  });

  const showAlert = useCallback((title, message, isError = false) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'alert',
      onConfirm: null,
      isError
    });
  }, []);

  const showConfirm = useCallback((title, message, onConfirm, isError = false) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
      isError,
      defaultValue: '',
      inputValue: ''
    });
  }, []);

  const showPrompt = useCallback((title, message, defaultValue, onConfirm) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'prompt',
      onConfirm,
      isError: false,
      defaultValue: defaultValue || '',
      inputValue: defaultValue || ''
    });
  }, []);

  const closeModal = useCallback(() => {
    setModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    if (modal.onConfirm) {
      if (modal.type === 'prompt') {
        modal.onConfirm(modal.inputValue);
      } else {
        modal.onConfirm();
      }
    }
    closeModal();
  }, [modal, closeModal]);

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, showPrompt }}>
      {children}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={closeModal} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: modal.isError ? '#f87171' : 'var(--text-color)' }}>{modal.title}</h3>
            </div>
            <div style={{ padding: '10px 0 20px 0' }}>
              <p style={{ lineHeight: '1.5', margin: 0 }}>{modal.message}</p>
              {modal.type === 'prompt' && (
                <input 
                  type="text" 
                  value={modal.inputValue} 
                  onChange={(e) => setModal(prev => ({...prev, inputValue: e.target.value}))}
                  style={{ width: '100%', padding: '8px', marginTop: '15px', boxSizing: 'border-box' }}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                />
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {(modal.type === 'confirm' || modal.type === 'prompt') && (
                <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              )}
              <button 
                className={modal.isError ? "btn-secondary" : "btn-primary"} 
                style={modal.isError && modal.type === 'confirm' ? { backgroundColor: '#f87171', color: 'white' } : {}}
                onClick={(modal.type === 'confirm' || modal.type === 'prompt') ? handleConfirm : closeModal}
              >
                {(modal.type === 'confirm' || modal.type === 'prompt') ? 'Confirm' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};
