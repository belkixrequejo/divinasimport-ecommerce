
import { useEffect, useRef, useState } from "react";

export default function Notification() {
  const [notification, setNotification] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const timerRef = useRef(null);
  const confirmationRef = useRef(null);

  useEffect(() => {
    const originalAlert = window.alert;
    const originalNotify = window.notify;
    const originalConfirmAction = window.confirmAction;

    function showNotification(message, type = "info", duration = 3500) {
      setNotification({
        message: String(message),
        type,
      });

      clearTimeout(timerRef.current);

      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          setNotification(null);
        }, duration);
      }
    }

    window.alert = (message) => {
      showNotification(message, "info");
    };

    window.notify = (message, type = "info", duration = 3500) => {
      showNotification(message, type, duration);
    };

    window.confirmAction = (message, options = {}) => {
      // Resolver una confirmación anterior si todavía está abierta
      if (confirmationRef.current) {
        confirmationRef.current(false);
      }

      return new Promise((resolve) => {
        confirmationRef.current = resolve;

        setConfirmation({
          message: String(message),
          title: options.title || "Confirmar acción",
          confirmText: options.confirmText || "Sí, continuar",
          cancelText: options.cancelText || "Cancelar",
          type: options.type || "info",
        });
      });
    };

    return () => {
      window.alert = originalAlert;

      if (originalNotify === undefined) {
        delete window.notify;
      } else {
        window.notify = originalNotify;
      }

      if (originalConfirmAction === undefined) {
        delete window.confirmAction;
      } else {
        window.confirmAction = originalConfirmAction;
      }

      clearTimeout(timerRef.current);

      if (confirmationRef.current) {
        confirmationRef.current(false);
        confirmationRef.current = null;
      }
    };
  }, []);

  function closeConfirmation(result) {
    if (confirmationRef.current) {
      confirmationRef.current(result);
      confirmationRef.current = null;
    }

    setConfirmation(null);
  }

  return (
    <>
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          <span className="notification-icon">
            {notification.type === "success" && "✓"}
            {notification.type === "error" && "×"}
            {notification.type === "warning" && "!"}
            {notification.type === "info" && "i"}
          </span>

          <span className="notification-message">
            {notification.message}
          </span>

          <button
            type="button"
            onClick={() => {
              clearTimeout(timerRef.current);
              setNotification(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      {confirmation && (
        <div
          className="customModalOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmation(false);
            }
          }}
        >
          <div className={`customModal customModal-${confirmation.type}`}>
            <div className="customModalIcon">
              {confirmation.type === "warning" ? "!" : "?"}
            </div>

            <h3>{confirmation.title}</h3>

            <p>{confirmation.message}</p>

            <div className="customModalActions">
              <button
                type="button"
                className="customModalCancel"
                onClick={() => closeConfirmation(false)}
              >
                {confirmation.cancelText}
              </button>

              <button
                type="button"
                className="customModalConfirm"
                onClick={() => closeConfirmation(true)}
              >
                {confirmation.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
