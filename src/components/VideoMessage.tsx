import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "../utils/cn";

interface Props {
  src: string;
  duration: number | null;
  own: boolean;
}

export default function VideoMessage({ src, duration, own }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  // Загружаем превью при монтировании
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.addEventListener("timeupdate", () => {
      if (video.duration && video.duration > 0) {
        setProgress(Math.min(1, video.currentTime / video.duration));
      }
    });
    video.addEventListener("ended", () => {
      setPlaying(false);
      setProgress(0);
    });
    video.currentTime = 0;
    // Загружаем первый кадр для превью
    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.1;
    }, { once: true });
  }, [src]);

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      // Останавливаем другие видео на странице
      document.querySelectorAll("video").forEach((v) => {
        if (v !== el) {
          v.pause();
        }
      });
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = videoRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (el.duration) el.currentTime = ratio * el.duration;
  }

  return (
    <div className="flex items-start gap-3 py-0.5">
      <video ref={videoRef} src={src} preload="metadata" className="hidden" />

      {/* Превью-видео */}
      <div
        className={cn(
          "relative block w-52 h-40 rounded-2xl overflow-hidden cursor-pointer bg-black/10",
          "transition-all duration-200 hover:shadow-lg"
        )}
        onClick={toggle}
      >
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
          onLoadedData={(e) => {
            e.currentTarget.currentTime = 0.1;
          }}
          onEnded={(e) => {
            e.currentTarget.currentTime = 0;
            e.currentTarget.pause();
          }}
        />

        {/* Кнопка play */}
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-200",
            playing ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-transform hover:scale-110">
            <Play className="h-5 w-5 text-white ml-0.5" fill="currentColor" strokeWidth={0} />
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
          <div
            className="h-full bg-white/90 transition-all duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Длительность */}
        <span className="absolute right-2 bottom-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
          {duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : ""}
        </span>
      </div>

      {/* Инлайн-прогресс-бар (как у аудио) — waveform-подобный */}
      <div
        onClick={seek}
        className="min-w-0 flex-1 cursor-pointer pt-6"
        role="slider"
        aria-label="Перемотка видео"
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
      >
        <div className="flex h-8 items-center gap-[2px]">
          {Array.from({ length: 30 }).map((_, i) => {
            const played = i / 30 <= progress;
            const h = 25 + ((i * 7) % 75);
            return (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={cn(
                  "w-[3px] shrink-0 rounded-full transition-colors duration-150",
                  played
                    ? own
                      ? "bg-white"
                      : "bg-ink"
                    : own
                      ? "bg-white/25"
                      : "bg-ink/20"
                )}
              />
            );
          })}
        </div>
        <p className={cn("mt-0.5 font-mono text-[10px] tabular-nums", own ? "text-white/55" : "text-black/40")}>
          {duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : ""}
        </p>
      </div>
    </div>
  );
}
