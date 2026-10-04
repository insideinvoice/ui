import * as React from "react";
import { cn } from "../../lib/utils";

export interface BouncingDotsProps extends React.HTMLAttributes<HTMLDivElement> {
  dotCount?: number;
  duration?: string;
}

const BouncingDots = React.forwardRef<HTMLDivElement, BouncingDotsProps>(
  ({ className, dotCount = 3, duration = "1.4s", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("inline-flex items-center gap-[0.35em]", className)}
      {...props}
    >
      {Array.from({ length: dotCount }).map((_, i) => (
        <span
          key={i}
          className="inline-block h-[0.55em] w-[0.55em] rounded-full bg-current"
          style={{
            animation: `bouncing-dot ${duration} ease-in-out ${i * 0.15}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bouncing-dot {
          0%, 80%, 100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
);
BouncingDots.displayName = "BouncingDots";

export { BouncingDots };
