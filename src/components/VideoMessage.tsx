import { useEffect, useRef, useState } from "react";
import { Maximize2, Play } from "lucide-react";
import { cn } from "../utils/cn";
import VideoFullscreen from "./VideoFullscreen";

interface Props {
  src: string;
  duration: number | null;
  own: boolean;
}

function durationLabel(seconds: number | null): string {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/**
 * Обычное видео из галереи: прямоугольная карточка-превью.
 * Нажатие открывает полноэкранный плеер.
 */
export default function VideoMessage({ src, duration, own }: Props) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [open, setOpen] = useState(false);

  // Показываем кадр чуть дальше начала, чтобы превью не было чёрным.
  useEffect(() => {
    const video = previewRef.current;
    if (!video) return;
    const onLoaded = () => {
      try {
        video.currentTime = 0.1;
      } catch {
        /* no-op */
      }
    };
    video.addEventListener("loadeddata", onLoaded, { once: true });
    if (video.readyState >= 2) onLoaded();
    return () => video.removeEventListener("loadeddata", onLoaded);
  }, [src]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "group/video relative block max-w-full overflow-hidden rounded-2xl bg-black text-left shadow-sm transition hover:shadow-lg",
          own ? "ring-1 ring-white/10" : "ring-1 ring-black/10"
        )}
        aria-label="Открыть видео на весь экран"
      >
        <video
          ref={previewRef}
          src={src}
          preload="metadata"
          muted
          playsInline
          className="block max-h-[380px] w-auto max-w-[320px] object-contain"
        />

        {/* Затемнение + кнопка воспроизведения */}
        <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover/video:bg-black/25">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition group-hover/video:scale-105">
            <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
          </span>
        </span>

        {/* Развернуть */}
        <span className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover/video:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>

        {duration ? (
          <span className="absolute right-2 bottom-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
            {durationLabel(duration)}
          </span>
        ) : null}
      </button>

      {open && <VideoFullscreen src={src} onClose={() => setOpen(false)} />}
    </>
  );
}
