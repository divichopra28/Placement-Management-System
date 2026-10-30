import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import Modal from './Modal';

const FeedbackContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

/** Toast notifications + promise-based confirmation dialogs. */
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-3), { id, message, type }]);
    setTimeout(() => dismiss(id), type === 'error' ? 7000 : 4000);
  }, [dismiss]);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setConfirmState({ ...opts, resolve });
  }), []);

  const close = (result) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast ${t.type}`}>
              <Icon size={18} color={t.type === 'error' ? 'var(--error)' : t.type === 'success' ? 'var(--success)' : 'var(--accent)'} />
              <p>{t.message}</p>
              <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={14} /></button>
            </div>
          );
        })}
      </div>
      {confirmState && (
        <ConfirmDialog {...confirmState} onCancel={() => close(false)} onConfirm={() => close(true)} />
      )}
    </FeedbackContext.Provider>
  );
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onCancel, onConfirm }) {
  const btnRef = useRef(null);
  useEffect(() => { btnRef.current?.focus(); }, []);
  return (
    <Modal
      title={title || 'Are you sure?'}
      onClose={onCancel}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" ref={btnRef} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      )}
    >
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', gap: 12 }}>
        {danger && <AlertTriangle size={20} color="var(--error)" style={{ flexShrink: 0 }} />}
        <div className="muted" style={{ color: 'var(--text)' }}>{message}</div>
      </div>
    </Modal>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}
