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

  React.useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg: string) => {
      showToast(String(msg), 'info');
    };
    return () => { window.alert = originalAlert; };
  }, [showToast]);

  const getStyle = (type: Toast['type']) => {
    switch (type) {
      case 'success': return { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: '✅' };
      case 'error': return { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: '⚠️' };
      case 'warning': return { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '💡' };
      default: return { bg: '#ffffff', border: '#e5e7eb', color: '#1a1815', icon: '📌' };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 99999, display: 'flex', flexDirection: 'column', gap: '10px',
        pointerEvents: 'none', width: 'min(440px, 88vw)',
      }}>
        {toasts.map((toast) => {
          const s = getStyle(toast.type);
          return (
            <div key={toast.id} style={{
              background: s.bg,
              border: `1.5px solid ${s.border}`,
              color: s.color,
              padding: '16px 20px',
              borderRadius: '14px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              display: 'flex', gap: '12px', alignItems: 'flex-start',
              pointerEvents: 'auto',
              animation: 'toastDropIn 0.4s cubic-bezier(0.16,1,0.3,1)',
              fontSize: '0.9rem', lineHeight: 1.65,
              fontFamily: 'var(--sans)',
            }}>
              <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '1px' }}>{s.icon}</span>
              <span style={{ whiteSpace: 'pre-wrap', flex: 1, fontWeight: 500 }}>{toast.message}</span>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{
                  background: 'transparent', border: 'none', color: s.color,
                  opacity: 0.4, width: '22px', height: '22px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', flexShrink: 0,
                }}
              >✕</button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toastDropIn {
          from { opacity: 0; transform: translateY(-16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}
