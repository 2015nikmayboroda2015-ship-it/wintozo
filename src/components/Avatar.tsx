import { Users } from "lucide-react";
import type { Profile } from "../lib/supabase";
import { avatarGradient, initials } from "../lib/utils";
import { cn } from "../utils/cn";

const SIZES: Record<string, string> = {
  sm: "h-9 w-9 text-[13px] rounded-xl",
  md: "h-11 w-11 text-[15px] rounded-2xl",
  lg: "h-14 w-14 text-lg rounded-[20px]",
  xl: "h-24 w-24 text-3xl rounded-[28px]",
};

const ICON: Record<string, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-10 w-10",
};

const DOTS: Record<string, string> = {
  sm: "h-2.5 w-2.5 border",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
  xl: "h-5 w-5 border-[3px]",
};

interface Props {
  /** Удобный путь для личных чатов */
  profile?: Profile | null;
  /** Явные значения (группы и кастомные случаи) */
  name?: string;
  avatarUrl?: string | null;
  seed?: string;
  group?: boolean;
  size?: keyof typeof SIZES;
  /** null — не показывать индикатор присутствия */
  online?: boolean | null;
  className?: string;
}

export default function Avatar({
  profile,
  name,
  avatarUrl,
  seed,
  group = false,
  size = "md",
  online = null,
  className,
}: Props) {
  const label = name ?? profile?.nickname ?? "W";
  const url = avatarUrl !== undefined ? avatarUrl : (profile?.avatar_url ?? null);
  const gradSeed = seed ?? profile?.username ?? label ?? "winchat";

  return (
    <div className={cn("relative shrink-0", className)}>
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden font-bold text-white select-none",
          SIZES[size]
        )}
        style={url ? undefined : { background: avatarGradient(gradSeed) }}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : group ? (
          <Users className={ICON[size]} strokeWidth={1.9} />
        ) : (
          initials(label)
        )}
      </div>
      {online !== null && (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 rounded-full border-white",
            DOTS[size],
            online ? "bg-emerald-500" : "bg-black/25"
          )}
        />
      )}
    </div>
  );
}
