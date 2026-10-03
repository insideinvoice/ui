import { BouncingDots } from "./loading-ui/bouncing-dots";

export default function LoadingDots({ className = "", size = "sm" }) {
  const sizeClasses = {
    xs: "text-[10px]",
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };
  return <BouncingDots className={`${sizeClasses[size] || "text-xs"} ${className}`} />;
}
