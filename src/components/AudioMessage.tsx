import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatDuration, waveform } from "../lib/utils";
import { cn } from "../utils/cn";

interface Props {
  src: string;
  duration: number | null;
  seed: string;
  own: boolean;
}

export default function AudioMessage({ src, duration, seed, own }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const bars = waveform(seed);
  const total = duration || 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : total;
      setElapsed(el.currentTime);
      setProgress(dur ? Math.min(1, el.currentTime / dur) : 0);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setElapsed(0);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
    };
  }, [total]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      // Останавливаем остальные голосовые на странице
      document.querySelectorAll("audio").forEach((a) => a !== el && a.pause());
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const dur = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : total;
    if (dur) {
      el.currentTime = ratio * dur;
      setProgress(ratio);
    }
  }

  return (
    <div className="flex min-w-[220px] items-center gap-3 py-0.5">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95",
          own ? "bg-white/15 text-white hover:bg-white/25" : "bg-ink text-white hover:bg-black"
        )}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
      >
        {playing ? (
          <Pause className="h-4 w-4" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="ml-0.5 h-4 w-4" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={seek}
          className="flex h-8 cursor-pointer items-center gap-[2px]"
          role="slider"
          aria-label="Перемотка"
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
        >
          {bars.map((v, i) => {
            const played = i / bars.length <= progress;
            return (
              <span
                key={i}
                style={{ height: `${Math.round(v * 100)}%` }}
                className={cn(
                  "w-[3px] shrink-0 rounded-full transition-colors duration-150",
                  own
                    ? played
                      ? "bg-white"
                      : "bg-white/30"
                    : played
                      ? "bg-ink"
                      : "bg-ink/20"
                )}
              />
            );
          })}
        </div>
        <p
          className={cn(
            "mt-0.5 font-mono text-[10px] tabular-nums",
            own ? "text-white/55" : "text-black/40"
          )}
        >
          {formatDuration(playing || elapsed > 0 ? elapsed : total)}
        </p>
      </div>
    </div>
  );
}
