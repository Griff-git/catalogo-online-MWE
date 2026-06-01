
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Info, X, AlertCircle } from 'lucide-react';
import { AppContext } from '../App';

type DialogType = 'confirm' | 'alert';
type DialogVariant = 'danger' | 'warning' | 'success' | 'info';

interface DialogOptions {
  title?: string;
  message: string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
}

interface DialogState extends DialogOptions {
  type: DialogType;
  resolve: (value: boolean) => void;
}

interface DialogContextType {
  confirm: (options: DialogOptions | string) => Promise<boolean>;
  alert: (options: DialogOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType>({} as DialogContextType);

export const useDialog = () => useContext(DialogContext);

const variantConfig = {
  danger: {
    icon: AlertTriangle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    confirmBg: 'bg-red-600 hover:bg-red-700',
  },
  warning: {
    icon: AlertCircle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    confirmBg: 'bg-amber-600 hover:bg-amber-700',
  },
  success: {
    icon: CheckCircle2,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    confirmBg: 'bg-green-600 hover:bg-green-700',
  },
  info: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    confirmBg: 'bg-blue-600 hover:bg-blue-700',
  },
};

const DialogModal: React.FC<{ dialog: DialogState; onClose: (result: boolean) => void }> = ({ dialog, onClose }) => {
  const { settings } = useContext(AppContext);
  const variant = dialog.variant || (dialog.type === 'confirm' ? 'warning' : 'info');
  const config = variantConfig[variant];
  const Icon = config.icon;
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const confirmBg = variant === 'info' && dialog.type === 'alert'
    ? '' : config.confirmBg;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onClick={() => onClose(false)}>
      <div className="fixed inset-0 bg-black/50 animate-in fade-in duration-200" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center`}>
              <Icon size={24} className={config.iconColor} />
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h3 className="text-base font-black text-gray-900 leading-tight">
                {dialog.title || (dialog.type === 'confirm' ? 'Confirmar ação' : 'Aviso')}
              </h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed whitespace-pre-line">{dialog.message}</p>
            </div>
            <button
              onClick={() => onClose(false)}
              className="flex-shrink-0 p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 md:px-8 pb-6 md:pb-8 flex gap-3 justify-end">
          {dialog.type === 'confirm' && (
            <button
              onClick={() => onClose(false)}
              className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
            >
              {dialog.cancelText || 'Cancelar'}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            onClick={() => onClose(true)}
            className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-all ${confirmBg}`}
            style={variant === 'info' && dialog.type === 'alert' ? { backgroundColor: settings.primaryColor } : undefined}
          >
            {dialog.confirmText || (dialog.type === 'confirm' ? 'Confirmar' : 'OK')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const showDialog = useCallback((type: DialogType, options: DialogOptions | string): Promise<boolean> => {
    const opts = typeof options === 'string' ? { message: options } : options;
    return new Promise(resolve => {
      setDialog({ ...opts, type, resolve });
    });
  }, []);

  const confirm = useCallback((options: DialogOptions | string) => showDialog('confirm', options), [showDialog]);
  const alert = useCallback(async (options: DialogOptions | string) => { await showDialog('alert', options); }, [showDialog]);

  const handleClose = useCallback((result: boolean) => {
    dialog?.resolve(result);
    setDialog(null);
  }, [dialog]);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialog && <DialogModal dialog={dialog} onClose={handleClose} />}
    </DialogContext.Provider>
  );
};
