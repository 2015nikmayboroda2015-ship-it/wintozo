/**
 * Секретные анимации WinPro — включаются в настройках.
 */

export interface WinProAnimation {
  id: string;
  name: string;
  description: string;
}

export const ANIMATIONS: WinProAnimation[] = [
  {
    id: "off",
    name: "Без анимаций",
    description: "Стандартные переходы интерфейса",
  },
  {
    id: "gold-dust",
    name: "Золотая пыль",
    description: "Яркие мерцающие частицы золота по всему экрану",
  },
  {
    id: "aurora",
    name: "Полярное сияние",
    description: "Переливающийся градиент с глубиной и движением",
  },
  {
    id: "crown-rain",
    name: "Дождь корон",
    description: "Насыщенный золотой дождь из частиц",
  },
  {
    id: "gradient-shift",
    name: "Плавный градиент",
    description: "Мягкое перетекание цветов по экрану",
  },
  {
    id: "ripple",
    name: "Волны пульса",
    description: "Пульсирующие волны света от центра",
  },
  {
    id: "nebula",
    name: "Космическая туманность",
    description: "Глубокие переливы фиолетового и розового",
  },
];

const KEY = "winchat_winpro_animation";

export function getAnimationId(): string {
  try {
    return localStorage.getItem(KEY) || "off";
  } catch {
    return "off";
  }
}

export function saveAnimationId(id: string): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* no-op */
  }
}
