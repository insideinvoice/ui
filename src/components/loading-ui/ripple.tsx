import * as React from "react";
import { cn } from "../../lib/utils";

export interface RippleProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const Ripple = React.forwardRef<SVGSVGElement, RippleProps>(
  ({ className, size = 48, ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("text-current", className)}
      {...props}
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="90 40"
        opacity="0.6"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="0;126"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.6;0.1;0.6"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
      <circle
        cx="24"
        cy="24"
        r="12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="50 26"
        opacity="0.9"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="76;0"
          dur="1.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.9;0.3;0.9"
          dur="1.5s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
);
Ripple.displayName = "Ripple";

export { Ripple };
