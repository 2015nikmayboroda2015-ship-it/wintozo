/**
 * Клиентское сжатие видео перед загрузкой.
 *
 * Видео проигрывается в невидимом <video>, кадры перерисовываются в canvas
 * уменьшенного размера, а canvas.captureStream() + MediaRecorder пишут новый
 * файл. Звук забираем через Web Audio и подмешиваем в поток.
 *
 * Если браузер не умеет MediaRecorder/AudioContext для видео, возвращаем
 * исходный файл — загрузка всё равно сработает.
 */

export interface CompressedVideo {
  blob: Blob;
  mime: string;
  ext: string;
  duration: number;
  compressed: boolean;
}

/** Максимальная длительность исходника: сжатие идёт в реальном времени. */
const MAX_SOURCE_SECONDS = 180;
/** Длинная сторона итогового видео. */
const MAX_LONG_SIDE = 720;
const VIDEO_BITRATE = 1_200_000;
const AUDIO_BITRATE = 96_000;

function extForMime(mime: string): string {
  const base = (mime || "").split(";")[0].trim().toLowerCase();
  if (base.includes("webm")) return "webm";
  if (base.includes("mp4")) return "mp4";
  if (base.includes("quicktime")) return "mov";
  if (base.includes("ogg")) return "ogv";
  if (base.includes("3gpp")) return "3gp";
  return base.split("/")[1] || "mp4";
}

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

function waitForMetadata(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && video.videoWidth > 0) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 20_000);
    const ok = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve();
    };
    const fail = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error("unsupported"));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", ok);
      video.removeEventListener("error", fail);
    };
    video.addEventListener("loadedmetadata", ok);
    video.addEventListener("error", fail);
  });
}

export async function compressVideo(
  file: File,
  onProgress?: (progress: number) => void
): Promise<CompressedVideo> {
  const fallback = (duration = 0): CompressedVideo => ({
    blob: file,
    mime: file.type || "video/mp4",
    ext: extForMime(file.type),
    duration,
    compressed: false,
  });

  if (!file.type.startsWith("video/")) throw new Error("Это не видеофайл");

  const mime = pickMime();
  if (!mime) return fallback();

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.preload = "auto";
  video.playsInline = true;
  video.volume = 1;

  let audioCtx: AudioContext | null = null;
  let srcNode: MediaElementAudioSourceNode | null = null;
  let destNode: MediaStreamAudioDestinationNode | null = null;
  let silentGain: GainNode | null = null;
  let canvasStream: MediaStream | null = null;

  try {
    try {
      await waitForMetadata(video);
    } catch {
      // Не смогли прочитать файл — отдаём оригинал как есть.
      return fallback(0);
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) return fallback(0);
    if (duration > MAX_SOURCE_SECONDS) {
      throw new Error("Видео длиннее 3 минут — обрежьте его и попробуйте снова");
    }

    const sourceW = video.videoWidth || 1280;
    const sourceH = video.videoHeight || 720;
    const scale = Math.min(1, MAX_LONG_SIDE / Math.max(sourceW, sourceH));
    const width = Math.max(2, Math.round((sourceW * scale) / 2) * 2);
    const height = Math.max(2, Math.round((sourceH * scale) / 2) * 2);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback(duration);

    // Перехватываем звук элемента <video>. silentGain(0) нужен, чтобы
    // граф работал, но видео не звучало вслух во время сжатия.
    try {
      const AudioCtx = window.AudioContext;
      if (AudioCtx) {
        audioCtx = new AudioCtx();
        srcNode = audioCtx.createMediaElementSource(video);
        destNode = audioCtx.createMediaStreamDestination();
        silentGain = audioCtx.createGain();
        silentGain.gain.value = 0;
        srcNode.connect(destNode);
        srcNode.connect(silentGain);
        silentGain.connect(audioCtx.destination);
        await audioCtx.resume();
      }
    } catch {
      destNode = null;
    }
    // Без аудиографа видео потеряет звук — лучше загрузить оригинал.
    if (!destNode) return fallback(duration);

    let rec: MediaRecorder;
    try {
      canvasStream = canvas.captureStream(30);
      destNode.stream.getAudioTracks().forEach((t) => canvasStream?.addTrack(t));
      rec = new MediaRecorder(canvasStream, {
        mimeType: mime,
        videoBitsPerSecond: VIDEO_BITRATE,
        audioBitsPerSecond: AUDIO_BITRATE,
      });
    } catch {
      // Контейнер/захват canvas не поддерживается — грузим оригинал.
      return fallback(duration);
    }

    const chunks: BlobPart[] = [];
    const blob = await new Promise<Blob | null>((resolve) => {
      let settled = false;
      let deadline = 0;
      const finish = (b: Blob | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(deadline);
        resolve(b);
      };

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onerror = () => finish(null);
      rec.onstop = () => {
        const type = (rec.mimeType || mime).split(";")[0] || mime;
        finish(new Blob(chunks, { type }));
      };

      const draw = () => {
        if (settled) return;
        try {
          ctx.drawImage(video, 0, 0, width, height);
        } catch {
          /* кадр ещё не готов */
        }
        const p = duration > 0 ? Math.min(0.99, video.currentTime / duration) : 0;
        onProgress?.(p);
        if (!video.ended) window.requestAnimationFrame(draw);
      };

      video.addEventListener(
        "ended",
        () => {
          try {
            ctx.drawImage(video, 0, 0, width, height);
          } catch {
            /* no-op */
          }
          if (rec.state === "recording") rec.stop();
          else finish(null);
        },
        { once: true }
      );
      video.addEventListener("error", () => finish(null), { once: true });

      try {
        rec.start(250);
      } catch {
        finish(null);
        return;
      }
      deadline = window.setTimeout(
        () => {
          if (rec.state === "recording") rec.stop();
          else finish(null);
        },
        (duration + 30) * 1000
      );

      video
        .play()
        .then(() => window.requestAnimationFrame(draw))
        .catch(() => {
          if (rec.state === "recording") rec.stop();
          else finish(null);
        });
    });

    if (!blob || blob.size === 0) return fallback(duration);

    // Иногда «сжатый» файл выходит больше исходного — тогда смысла нет.
    if (blob.size >= file.size) return fallback(duration);

    onProgress?.(1);
    const outMime = blob.type || mime;
    return {
      blob,
      mime: outMime,
      ext: extForMime(outMime),
      duration,
      compressed: true,
    };
  } finally {
    try {
      video.pause();
    } catch {
      /* no-op */
    }
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      /* no-op */
    }
    URL.revokeObjectURL(url);
    canvasStream?.getTracks().forEach((t) => t.stop());
    try {
      srcNode?.disconnect();
      destNode?.disconnect();
      silentGain?.disconnect();
    } catch {
      /* no-op */
    }
    try {
      await audioCtx?.close();
    } catch {
      /* no-op */
    }
  }
}
