import { cn } from "../utils/cn";

const SIZES: Record<string, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-6 w-6",
};

interface Props {
  size?: keyof typeof SIZES;
  className?: string;
}

/** Синяя галочка верификации — чистый SVG, без эмодзи. */
export default function Verified({ size = "sm", className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="Подтверждённый аккаунт"
      className={cn("shrink-0", SIZES[size], className)}
    >
      <title>Подтверждённый аккаунт</title>
      <path
        fill="#1d9bf0"
        d="M12 1.6l2.47 1.9 3.1-.3 1.26 2.86 2.86 1.27-.3 3.1L23.3 13l-1.9 2.47.3 3.1-2.87 1.26-1.26 2.86-3.1-.3L12 24.3l-2.47-1.9-3.1.3-1.26-2.87L2.3 18.6l.3-3.1L.7 13l1.9-2.47-.3-3.1 2.87-1.26L6.43 3.3l3.1.3L12 1.6z"
      />
      <path
        fill="#fff"
        d="M10.63 15.76l-3.2-3.2 1.42-1.41 1.78 1.78 4.52-4.52 1.41 1.42-5.93 5.93z"
      />
    </svg>
  );
}
