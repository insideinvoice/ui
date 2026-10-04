import { BouncingDots } from "./loading-ui/bouncing-dots";

export default function LoadingDots({ className = "" }) {
  return <BouncingDots className={`w-16 justify-center ${className}`} />;
}
