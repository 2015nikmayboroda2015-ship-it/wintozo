import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2, Plus, Send, Sticker, X } from "lucide-react";
import {
  addStickerToPack,
  createStickerPack,
  listStickerPacks,
  saveStickerToPack,
  uploadSticker,
  type StickerPack,
} from "../lib/stickerStorage";
import { cn } from "../utils/cn";

interface Props {
  meId: string;
  /** picker — выбрать и отправить; save — сохранить полученный стикер себе. */
  mode: "picker" | "save";
  saveUrl?: string | null;
  onClose: () => void;
  onSend?: (url: string) => void;
  onSaved?: (message: string) => void;
}

export default function StickerPanel({ meId, mode, saveUrl, onClose, onSend, onSaved }: Props) {
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busyPackId, setBusyPackId] = useState<string | null>(null);
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listStickerPacks();
      setPacks(list);
      setActiveId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        const mine = list.find((p) => p.owner_id === meId && p.items.length > 0);
        return mine?.id ?? list.find((p) => p.owner_id === meId)?.id ?? list[0]?.id ?? null;
      });
      if (list.length === 0) setCreating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить стикеры");
    } finally {
      setLoading(false);
    }
  }, [meId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = packs.find((p) => p.id === activeId) ?? null;
  const mine = !!active && active.owner_id === meId;

  async function createPack(saveAfterCreate = false) {
    if (creatingBusy) return;
    setCreatingBusy(true);
    setError(null);
    try {
      const pack = await createStickerPack(newName, meId);
      setNewName("");
      setCreating(false);
      await load();
      setActiveId(pack.id);
      if (saveAfterCreate && saveUrl) {
        await saveStickerToPack(saveUrl, meId, pack.id);
        setSavedTo(pack.name);
        onSaved?.(`Стикер сохранён в «${pack.name}»`);
        window.setTimeout(onClose, 900);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать пак");
    } finally {
      setCreatingBusy(false);
    }
  }

  async function addToActive(file: File) {
    if (!active || !mine || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadSticker(file, meId);
      await addStickerToPack(active.id, meId, url);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить стикер");
    } finally {
      setUploading(false);
    }
  }

  async function saveTo(pack: StickerPack) {
    if (!saveUrl || busyPackId) return;
    setBusyPackId(pack.id);
    setError(null);
    try {
      await saveStickerToPack(saveUrl, meId, pack.id);
      setSavedTo(pack.name);
      onSaved?.(`Стикер сохранён в «${pack.name}»`);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить стикер");
    } finally {
      setBusyPackId(null);
    }
  }

  async function saveToSavedPack() {
    if (!saveUrl || busyPackId) return;
    setBusyPackId("saved");
    setError(null);
    try {
      const pack = await saveStickerToPack(saveUrl, meId);
      await load();
      setSavedTo(pack.name);
      onSaved?.(`Стикер сохранён в «${pack.name}»`);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить стикер");
    } finally {
      setBusyPackId(null);
    }
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-[70] flex items-end justify-center bg-ink/45 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="animate-slide-up flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center gap-3 border-b border-black/8 px-4 py-3.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Sticker className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold tracking-tight">
              {mode === "save" ? "Сохранить стикер" : "Стикеры"}
            </p>
            <p className="text-[12px] font-medium text-black/45">
              {mode === "save"
                ? "Выберите пак — стикер появится у вас"
                : "Выберите стикер или загрузите новый в свой пак"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-black/40 transition hover:bg-black/5 hover:text-ink"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mx-4 mt-3 rounded-2xl bg-red-50 px-3.5 py-2.5 text-[12px] font-bold text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 py-20 text-sm font-semibold text-black/45">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загружаем паки…
          </div>
        ) : (
          <>
            {/* Паки */}
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {packs.map((pack) => (
                <button
                  key={pack.id}
                  onClick={() => {
                    setActiveId(pack.id);
                    setSavedTo(null);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-2 text-left transition",
                    activeId === pack.id
                      ? "border-accent/40 bg-accent/8 text-ink"
                      : "border-black/8 bg-white text-black/60 hover:bg-paper"
                  )}
                >
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-paper">
                    {pack.items[0] ? (
                      <img
                        src={pack.items[0].url}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Sticker className="h-4 w-4 text-black/30" />
                    )}
                  </span>
                  <span className="max-w-[120px] truncate text-[12px] font-bold">
                    {pack.name}
                  </span>
                  {pack.owner_id === meId && (
                    <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[9px] font-extrabold text-accent">
                      мой
                    </span>
                  )}
                </button>
              ))}
              <button
                onClick={() => setCreating(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-black/15 px-3 py-2 text-[12px] font-bold text-black/50 transition hover:border-accent/40 hover:text-accent"
              >
                <Plus className="h-4 w-4" />
                Пак
              </button>
            </div>

            {/* Создание пака */}
            {creating && (
              <div className="mx-4 mb-3 flex items-center gap-2 rounded-2xl bg-paper p-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void createPack(mode === "save");
                  }}
                  placeholder="Название пака"
                  autoFocus
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-accent/50"
                />
                <button
                  onClick={() => void createPack(mode === "save")}
                  disabled={creatingBusy || !newName.trim()}
                  className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-[12px] font-bold text-white transition disabled:opacity-40"
                >
                  {creatingBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Создать
                </button>
                {packs.length > 0 && (
                  <button
                    onClick={() => {
                      setCreating(false);
                      setNewName("");
                    }}
                    className="rounded-xl p-2 text-black/40 hover:bg-black/5"
                    aria-label="Отменить создание"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-4 pb-5">
              {mode === "save" && saveUrl && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-3">
                  <img src={saveUrl} alt="Стикер" className="h-16 w-16 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold">Этот стикер</p>
                    <p className="text-[11px] font-medium text-black/45">
                      Нажмите на пак ниже, чтобы сохранить
                    </p>
                  </div>
                  <button
                    onClick={() => void saveToSavedPack()}
                    disabled={busyPackId !== null}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[11px] font-bold text-white transition disabled:opacity-50"
                  >
                    {busyPackId === "saved" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    В «Сохранённые»
                  </button>
                </div>
              )}

              {mode === "save" ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {packs.map((pack) => (
                    <button
                      key={pack.id}
                      onClick={() => void saveTo(pack)}
                      disabled={busyPackId !== null}
                      className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white p-2.5 text-left transition hover:border-accent/40 hover:bg-accent/5 disabled:opacity-50"
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper">
                        {pack.items[0] ? (
                          <img src={pack.items[0].url} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <Sticker className="h-4 w-4 text-black/30" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold">{pack.name}</span>
                        <span className="block text-[10px] font-semibold text-black/40">
                          {pack.items.length} стикеров
                        </span>
                      </span>
                      {busyPackId === pack.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-accent" />
                      ) : savedTo === pack.name ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : !active ? (
                <div className="flex flex-col items-center py-14 text-center">
                  <Sticker className="h-12 w-12 text-black/20" />
                  <p className="mt-3 text-sm font-bold">Паков пока нет</p>
                  <p className="mt-1 text-[12px] font-medium text-black/45">
                    Создайте первый пак и добавьте в него стикеры
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-extrabold">{active.name}</p>
                      <p className="text-[11px] font-semibold text-black/40">
                        {active.items.length} стикеров
                        {!mine && " · чужой пак"}
                      </p>
                    </div>
                    {mine && (
                      <>
                        <button
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                          className="flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-[11px] font-bold text-white transition hover:bg-black disabled:opacity-50"
                        >
                          {uploading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ImagePlus className="h-3.5 w-3.5" />
                          )}
                          Добавить
                        </button>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*,.gif"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void addToActive(f);
                            e.target.value = "";
                          }}
                        />
                      </>
                    )}
                  </div>

                  {active.items.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-black/10 py-12 text-center">
                      <Sticker className="h-10 w-10 text-black/20" />
                      <p className="mt-2 text-[13px] font-bold">В паке пока пусто</p>
                      <p className="mt-1 text-[11px] font-medium text-black/45">
                        {mine ? "Нажмите «Добавить», чтобы загрузить стикер" : "Выберите другой пак"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {active.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (mode !== "picker") {
                              void saveTo(active);
                            } else {
                              onSend?.(item.url);
                              onClose();
                            }
                          }}
                          className="group relative aspect-square rounded-2xl p-1.5 transition hover:bg-paper active:scale-95"
                          title={mode !== "picker" ? "Сохранить стикер" : "Отправить стикер"}
                        >
                          <img
                            src={item.url}
                            alt="Стикер"
                            loading="lazy"
                            className="h-full w-full object-contain transition group-hover:scale-105"
                          />
                          {mode === "picker" && (
                            <span className="pointer-events-none absolute right-1 bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-white opacity-0 transition group-hover:opacity-100">
                              <Send className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
