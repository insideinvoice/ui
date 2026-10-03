import { Ripple } from "./loading-ui/ripple";

export default function Spinner({ size = 24, className = "" }) {
  return <Ripple size={size} className={className} />;
}
