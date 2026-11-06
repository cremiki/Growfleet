import type { VehicleStatus } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/format";

/** Quadratino colorato con l'icona dello stato, uguale a quello sulla mappa */
export function StatusIcon({ status, course, size = 24 }: { status: VehicleStatus; course?: number | null; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[5px]" style={{ width: size, height: size, background: STATUS_COLOR[status] }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        {status === "moving"
          ? <g transform={`rotate(${course ?? 0} 12 12)`}><path d="M12 4 L17.5 17 L12 14 L6.5 17 Z" fill="#fff" /></g>
          : <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" fill="#fff" />}
      </svg>
    </span>
  );
}
