import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play } from "lucide-react";
import { cn } from "../utils/cn";
import VideoFullscreen from "./VideoFullscreen";

interface Props {
  src: string;
  duration: number | null;
  own: boolean;
}

const RADIUS = 48;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function durationLabel(seconds: number | null): string {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

/**
 * Видеокружок: настоящее круглое видео, снятое пользователем.
 * Проигрывается внутри круга, отдельная кнопка открывает полный экран.
 */
export default function VideoCircle({ src, duration, own }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (video.duration && video.duration > 0) {
        setProgress(Math.min(1, video.currentTime / video.duration));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      try {
        video.currentTime = 0;
      } catch {
        /* no-op */
      }
    };
    const onLoaded = () => {
      try {
        video.currentTime = 0.1;
      } catch {
        /* no-op */
      }
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("loadeddata", onLoaded, { once: true });
    if (video.readyState >= 2) onLoaded();
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("loadeddata", onLoaded);
    };
  }, [src]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }
    document.querySelectorAll("video").forEach((el) => {
      if (el !== video) el.pause();
    });
    video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  return (
    <>
      <div className="relative h-48 w-48 select-none sm:h-56 sm:w-56">
        {/* Кольцо прогресса вокруг кружка */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="2.5"
            className={own ? "stroke-white/20" : "stroke-black/10"}
          />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            className={cn(
              "transition-[stroke-dashoffset] duration-200",
              own ? "stroke-white/85" : "stroke-emerald-500"
            )}
          />
        </svg>

        <button
          type="button"
          onClick={toggle}
          className="group/circle absolute inset-[3px] overflow-hidden rounded-full bg-black ring-1 ring-black/20"
          aria-label={playing ? "Пауза" : "Воспроизвести видеокружок"}
        >
          <video
            ref={videoRef}
            src={src}
            preload="metadata"
            playsInline
            className="h-full w-full object-cover"
          />

          <span
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center transition-colors",
              playing ? "bg-transparent" : "bg-black/20"
            )}
          >
            <span
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition",
                playing
                  ? "scale-90 opacity-0 group-hover/circle:scale-100 group-hover/circle:opacity-100"
                  : "opacity-100 group-hover/circle:scale-105"
              )}
            >
              {playing ? (
                <Pause className="h-6 w-6" fill="currentColor" strokeWidth={0} />
              ) : (
                <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
              )}
            </span>
          </span>

          {!playing && duration ? (
            <span className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 font-mono text-[10px] font-semibold text-white backdrop-blur-sm">
              {durationLabel(duration)}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            videoRef.current?.pause();
            setPlaying(false);
            setOpen(true);
          }}
          className="absolute right-0 bottom-0 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md backdrop-blur-sm transition hover:bg-black/75"
          aria-label="Открыть видео на весь экран"
          title="На весь экран"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && <VideoFullscreen src={src} onClose={() => setOpen(false)} />}
    </>
  );
}
