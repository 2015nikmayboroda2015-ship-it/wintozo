import { cn } from "../utils/cn";

interface Props {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

const SIZES = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
};

/** SVG корона WinPro — золотая с градиентом */
export default function Crown({ className, size = "sm" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="WinPro"
      className={cn("shrink-0 winpro-crown-glow", SIZES[size], className)}
    >
      <title>WinPro</title>
      <defs>
        <linearGradient id="crown-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#FF8C00" />
        </linearGradient>
      </defs>
      <path
        d="M3 17l2-9 4 4 3-7 3 7 4-4 2 9H3z"
        fill="url(#crown-gold)"
        stroke="#B8860B"
        strokeWidth="0.5"
      />
      <rect x="3" y="18" width="18" height="2.5" rx="1" fill="url(#crown-gold)" stroke="#B8860B" strokeWidth="0.3" />
      <circle cx="5" cy="8" r="1.2" fill="#FFD700" />
      <circle cx="12" cy="5" r="1.4" fill="#FFD700" />
      <circle cx="19" cy="8" r="1.2" fill="#FFD700" />
    </svg>
  );
}
