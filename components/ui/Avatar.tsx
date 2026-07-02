import { User } from "lucide-react";
import { cn, initials, avatarColorFromString } from "@/lib/utils";

type AvatarProps = {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  color?: string;
};

const sizeStyles = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-20 w-20 text-2xl",
};

const iconSizes = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-10 w-10",
};

export function Avatar({ name, src, size = "md", className, color }: AvatarProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(
          "rounded-full object-cover flex-shrink-0",
          sizeStyles[size],
          className,
        )}
      />
    );
  }

  const computedColor = color ?? avatarColorFromString(name);
  const label = initials(name);

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0",
        computedColor,
        sizeStyles[size],
        className,
      )}
    >
      {label || <User className={iconSizes[size]} />}
    </div>
  );
}
