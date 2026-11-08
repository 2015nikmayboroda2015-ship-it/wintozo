import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface Props {
  src: string;
  onClose: () => void;
}

/** Полноэкранный просмотр видео поверх интерфейса чата. */
export default function VideoFullscreen({ src, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[80] flex items-center justify-center bg-black/95 p-3 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр видео"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition hover:bg-white/20"
        aria-label="Закрыть видео"
      >
        <X className="h-5 w-5" />
      </button>
      <video
        src={src}
        controls
        autoPlay
        playsInline
        className="max-h-[92dvh] max-w-[96vw] rounded-xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}
