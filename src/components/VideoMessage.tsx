import { useEffect, useRef, useState } from "react";
import { Download, Maximize2, Play } from "lucide-react";
import { cn } from "../utils/cn";
import VideoFullscreen from "./VideoFullscreen";

interface Props {
  src: string;
  duration: number | null;
  own: boolean;
  /** Скачать видео в DCIM/WinChat/Video (кнопка появляется, если передан обработчик). */
  onDownload?: () => void;
}

function durationLabel(seconds: number | null): string {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/**
 * Обёртка видео для сообщений: показывает видеоплеер с превью-кадром.
 * Открывается в полноэкранном просмотре по нажатию.
 */
export default function VideoMessage({ src, duration, own, onDownload }: Props) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [open, setOpen] = useState(false);

  // Показываем первый кадр вместо чёрного прямоугольника.
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
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          "group/video relative block max-w-full cursor-pointer overflow-hidden rounded-2xl bg-black text-left shadow-sm transition hover:shadow-lg",
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
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover/video:bg-black/25">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition group-hover/video:scale-105">
            <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
          </span>
        </span>

        {onDownload && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="absolute top-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75"
            aria-label="Скачать видео в DCIM/WinChat/Video"
            title="Скачать в DCIM/WinChat/Video"
          >
            <Download className="h-4 w-4" />
          </button>
        )}

        {/* Развернуть */}
        <span className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur-sm transition group-hover/video:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>

        {duration ? (
          <span className="absolute right-2 bottom-2 rounded-md bg-black/65 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
            {durationLabel(duration)}
          </span>
        ) : null}
      </div>

      {open && <VideoFullscreen src={src} onClose={() => setOpen(false)} />}
    </>
  );
}
