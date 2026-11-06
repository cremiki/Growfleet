import type { VehicleStatus } from "@/lib/types";
import { STATUS_COLOR } from "@/lib/format";
import { glyphFor } from "@/components/map/shared";

/** Quadratino colorato con l'icona dello stato, uguale a quello sulla mappa */
export function StatusIcon({ status, course, type, size = 24 }: { status: VehicleStatus; course?: number | null; type?: string | null; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-[5px]" style={{ width: size, height: size, background: STATUS_COLOR[status] }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        {status === "moving"
          ? <g transform={`rotate(${course ?? 0} 12 12)`}><path d="M12 4 L17.5 17 L12 14 L6.5 17 Z" fill="#fff" /></g>
          : <g dangerouslySetInnerHTML={{ __html: glyphFor(type) }} />}
      </svg>
    </span>
  );
}
