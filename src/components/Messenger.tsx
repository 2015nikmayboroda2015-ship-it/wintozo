import type { ComponentProps } from "react";
import MessengerBase from "./messenger/themes/MessengerBase";
import MessengerModern from "./messenger/themes/MessengerModern";
import { isWinChatLegacy, type Profile } from "../lib/supabase";

/**
 * Точка входа мессенджера.
 *
 * База (winchat-legacy): стабильный интерфейс — открывается, если у профиля
 * выставлен флаг is_winchat_legacy_true (команды /set legacy и /del legacy
 * в админ-терминале) или если в новой теме случился баг.
 *
 * Новая тема: красивый переработанный интерфейс поверх базы
 * (src/components/messenger/themes).
 */
type Props = ComponentProps<typeof MessengerBase>;

export default function Messenger(props: Props) {
  const legacy = isWinChatLegacy(props.me as Profile);
  if (legacy) return <MessengerBase {...props} />;
  return <MessengerModern {...props} />;
}
