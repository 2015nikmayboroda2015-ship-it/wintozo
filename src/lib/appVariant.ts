export type AppVariant = "default" | "store" | "you";

const raw = (import.meta.env.VITE_APP_VARIANT as string | undefined)?.toLowerCase();
export const APP_VARIANT: AppVariant =
  raw === "store" ? "store" : raw === "you" ? "you" : "default";

export const isStoreApp = APP_VARIANT === "store";
export const isYouOnlyApp = APP_VARIANT === "you";

/** Отображаемое имя приложения для текущего билда. */
export const APP_BRAND = isStoreApp
  ? "Wintozo Store"
  : isYouOnlyApp
    ? "WinChat You"
    : "WinChat";

/** Android applicationId / package для текущего билда. */
export const APP_PACKAGE_ID = isStoreApp
  ? "com.winchat.store"
  : isYouOnlyApp
    ? "org.winchat.you"
    : "org.wintozo.messenger";
