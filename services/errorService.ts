import toast from 'react-hot-toast';

export interface AppError {
  message: string;
  code?: string;
  canRetry?: boolean;
  originalError?: Error;
}

export const handleError = (error: unknown, context?: string): AppError => {
  let appError: AppError;

  if (error instanceof Error) {
    appError = {
      message: error.message,
      originalError: error,
      canRetry: isRetryableError(error)
    };
  } else if (typeof error === 'string') {
    appError = {
      message: error,
      canRetry: false
    };
  } else {
    appError = {
      message: 'Une erreur inconnue est survenue',
      canRetry: false
    };
  }

  // Add context if provided
  if (context) {
    console.error(`[${context}]`, appError);
  } else {
    console.error(appError);
  }

  return appError;
};

const isRetryableError = (error: Error): boolean => {
  const retryableErrors = [
    'NetworkError',
    'TimeoutError',
    'AbortError',
    'Failed to fetch',
    'Load failed',
    'Network request failed'
  ];

  return retryableErrors.some(pattern => 
    error.message.includes(pattern) || error.name.includes(pattern)
  );
};

// Toast helpers
export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'bottom-right',
  });
};

export const showError = (error: AppError | string, onRetry?: () => void) => {
  const message = typeof error === 'string' ? error : error.message;
  const canRetry = typeof error === 'object' && error.canRetry;

  if (canRetry && onRetry) {
    toast.error(
      (t) => (
        <div className="flex items-center gap-3">
          <span className="flex-1">{message}</span>
          <button
            onClick={() => {
              toast.dismiss(t.id);
              onRetry();
            }}
            className="bg-white text-red-600 px-3 py-1 rounded font-medium text-sm hover:bg-gray-100 transition-colors"
          >
            Réessayer
          </button>
        </div>
      ),
      {
        duration: 6000,
        position: 'bottom-right',
      }
    );
  } else {
    toast.error(message, {
      duration: 4000,
      position: 'bottom-right',
    });
  }
};

export const showWarning = (message: string) => {
  toast(message, {
    icon: '⚠️',
    duration: 4000,
    position: 'bottom-right',
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    icon: 'ℹ️',
    duration: 3000,
    position: 'bottom-right',
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message, {
    position: 'bottom-right',
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
