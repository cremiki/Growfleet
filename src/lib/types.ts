// Tipi condivisi tra server e browser

export type VehicleStatus = "moving" | "idle" | "stopped" | "offline" | "nodata";

export type VehicleState = {
  id: number;
  name: string;
  ident: string;
  cid: number | null;
  connected: boolean;
  /** Ultimo messaggio ricevuto (unix secondi) */
  lastSeen: number | null;
  lat: number | null;
  lon: number | null;
  speed: number | null; // km/h
  course: number | null; // gradi
  satellites: number | null;
  positionTs: number | null;
  ignition: boolean | null;
  movement: boolean | null;
  fuelLevel: number | null; // %
  fuelVolume: number | null; // litri
  odometerKm: number | null;
  engineHours: number | null;
  batteryV: number | null;
  externalV: number | null;
  gsmSignal: number | null;
  status: VehicleStatus;
};

export type TelemetryEntry = { name: string; value: unknown; ts: number };

export type VehicleDetail = { state: VehicleState; telemetry: TelemetryEntry[] };

export type TrackPoint = {
  ts: number;
  lat: number;
  lon: number;
  speed: number | null;
  ignition: boolean | null;
};

export type Subaccount = { id: number; name: string };

export const STATUS_LABEL: Record<VehicleStatus, string> = {
  moving: "In marcia",
  idle: "Fermo, quadro acceso",
  stopped: "Spento",
  offline: "Non raggiungibile",
  nodata: "Nessuna posizione",
};
