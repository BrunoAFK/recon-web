import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({
  title,
  onClose,
  children,
  maxWidth = "max-w-2xl",
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div
        className={`${maxWidth} w-full bg-surface border border-border/70 rounded-2xl shadow-2xl max-h-[88vh] flex flex-col animate-fade-in overflow-hidden`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-border/60 bg-background/20">
            <h3 className="text-xl font-semibold text-foreground truncate" style={{ fontFamily: "var(--font-display)" }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              className="rounded-xl border border-border/50 p-2 hover:bg-surface-light text-muted hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
