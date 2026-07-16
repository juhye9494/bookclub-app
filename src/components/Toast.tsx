"use client";
import React, { createContext, useContext, useState, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastContextType {
  showToast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Override window.alert globally
  React.useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg: string) => {
      showToast(String(msg), 'info');
    };
    return () => { window.alert = originalAlert; };
  }, [showToast]);

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getBg = (type: Toast['type']) => {
    switch (type) {
      case 'success': return 'linear-gradient(135deg, #059669, #10b981)';
      case 'error': return 'linear-gradient(135deg, #dc2626, #ef4444)';
      case 'warning': return 'linear-gradient(135deg, #d97706, #f59e0b)';
      default: return 'linear-gradient(135deg, #1a1815, #374151)';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div style={{
        position: 'fixed', top: '80px', right: '20px', zIndex: 99999,
        display: 'flex', flexDirection: 'column', gap: '10px',
        pointerEvents: 'none', maxWidth: 'min(420px, 90vw)',
      }}>
        {toasts.map((toast, index) => (
          <div key={toast.id} style={{
            background: getBg(toast.type),
            color: '#fff',
            padding: '16px 20px',
            borderRadius: '14px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            display: 'flex', gap: '12px', alignItems: 'flex-start',
            pointerEvents: 'auto',
            animation: 'toastSlideIn 0.35s cubic-bezier(0.16,1,0.3,1)',
            backdropFilter: 'blur(12px)',
            fontSize: '0.9rem', lineHeight: 1.6,
            fontFamily: 'var(--sans)',
          }}>
            <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '1px' }}>{getIcon(toast.type)}</span>
            <span style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
                width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', flexShrink: 0,
              }}
            >✕</button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(60px) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
