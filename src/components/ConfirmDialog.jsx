import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export default function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  iconType = "danger", // 'danger' | 'info' | 'warning'
  confirmColor = "#ef4444",
  onConfirm,
  onCancel,
}) {
  const cardRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onConfirm, onCancel]);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (cardRef.current && !cardRef.current.contains(e.target)) {
      onCancel();
    }
  };

  const iconTypeStyles = {
    danger: {
      icon: <AlertTriangle size={28} />,
      iconBg: "rgba(239, 68, 68, 0.1)",
      iconColor: "#ef4444",
    },
    info: {
      icon: <CheckCircle2 size={28} />,
      iconBg: "rgba(16, 185, 129, 0.1)",
      iconColor: "#10b981",
    },
    warning: {
      icon: <AlertTriangle size={28} />,
      iconBg: "rgba(245, 158, 11, 0.1)",
      iconColor: "#f59e0b",
    },
  };

  const style = iconTypeStyles[iconType] || iconTypeStyles.danger;
  const shadowColor = confirmColor + "4D"; // 30% opacity hex

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={cardRef}
            className="confirm-card"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            {/* Header with Icon */}
            <div className="confirm-header">
              <div
                className="confirm-icon-wrapper"
                style={{
                  background: style.iconBg,
                  color: style.iconColor,
                }}
              >
                {style.icon}
              </div>
              <button className="confirm-close-btn" onClick={onCancel}>
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="confirm-content">
              <h3 className="confirm-title">{title}</h3>
              <p className="confirm-message">{message}</p>
            </div>

            {/* Actions */}
            <div className="confirm-actions">
              <button className="confirm-btn-secondary" onClick={onCancel}>
                {cancelText}
              </button>
              <button
                className="confirm-btn-primary"
                onClick={onConfirm}
                style={{
                  background: confirmColor,
                  boxShadow: `0 10px 25px -5px ${shadowColor}`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.filter = "brightness(1.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.filter = "brightness(1)")
                }
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

