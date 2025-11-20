import { useEffect } from 'react';
import { useUIStore } from '../store/uiStore';

export default function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(() => {
        onClose();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  const getToastStyles = () => {
    const baseStyles = 'flex items-center p-4 rounded-lg shadow-lg min-w-[300px] max-w-md';
    
    switch (toast.type) {
      case 'success':
        return `${baseStyles} bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800`;
      default:
        return `${baseStyles} bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700`;
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  const getTextColor = () => {
    switch (toast.type) {
      case 'success':
        return 'text-green-800 dark:text-green-300';
      case 'error':
        return 'text-red-800 dark:text-red-300';
      case 'warning':
        return 'text-yellow-800 dark:text-yellow-300';
      case 'info':
        return 'text-blue-800 dark:text-blue-300';
      default:
        return 'text-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className={getToastStyles()}>
      <span className="mr-3 text-xl">{getIcon()}</span>
      <p className={`flex-1 text-sm font-medium ${getTextColor()}`}>
        {toast.message}
      </p>
      <button
        onClick={onClose}
        className="ml-3 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
