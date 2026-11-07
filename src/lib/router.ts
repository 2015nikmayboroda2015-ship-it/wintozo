/**
 * Лёгкий роутер WinChat.
 * Навигация без перезагрузки страницы: pushState + событие popstate,
 * которое слушает useRoute в App.
 */
export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Заменить текущий адрес, не добавляя запись в историю. */
export function replaceRoute(path: string): void {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Текущий путь приложения. */
export function currentPath(): string {
  return window.location.pathname;
}
