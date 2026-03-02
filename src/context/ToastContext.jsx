import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Toast from '../components/Toast';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', isError: false, visible: false });
  const timerRef = useRef(null);

  const showToast = useCallback((message, isError = false) => {
    clearTimeout(timerRef.current);
    setToast({ message, isError, visible: true });
    timerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 1800);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Toast message={toast.message} isError={toast.isError} visible={toast.visible} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
