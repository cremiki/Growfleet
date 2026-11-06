/** Nomi leggibili dei parametri flespi più comuni, con unità. Gli altri si mostrano col nome tecnico. */
export const PARAM_LABELS: Record<string, [string, string?]> = {
  "ambient.air.temperature": ["Temperatura ambiente", "°C"],
  "battery.level": ["Batteria backup", "%"],
  "battery.voltage": ["Voltaggio batteria interna", "V"],
  "external.powersource.voltage": ["Tensione di alimentazione", "V"],
  "position.altitude": ["Altitudine GPS", "m"],
  "position.satellites": ["Satelliti"],
  "position.valid": ["Stato GPS"],
  "position.hdop": ["Precisione GPS (HDOP)"],
  "engine.ignition.status": ["Chiave"],
  "movement.status": ["In movimento"],
  "pto.status": ["Presa di forza (PTO)"],
  "gsm.signal.level": ["Segnale GSM", "%"],
  "gsm.operator.code": ["Operatore telefonico"],
  "can.fuel.level": ["CAN livello carburante", "%"],
  "can.fuel.volume": ["CAN carburante nel serbatoio", "l"],
  "can.fuel.consumed": ["CAN carburante totale consumato", "l"],
  "fuel.level": ["Livello carburante", "%"],
  "can.vehicle.mileage": ["CAN contachilometri", "km"],
  "vehicle.mileage": ["Chilometraggio GPS", "km"],
  "can.engine.motorhours": ["CAN ore motore", "h"],
  "can.engine.rpm": ["CAN giri motore", "rpm"],
  "can.engine.temperature": ["CAN temperatura motore", "°C"],
  "can.vehicle.speed": ["CAN velocità", "km/h"],
  "position.speed": ["Velocità GPS", "km/h"],
  "position.direction": ["Direzione", "°"],
};

const ONOFF = new Set(["engine.ignition.status", "position.valid", "pto.status", "movement.status"]);

export function formatParam(name: string, value: unknown): string {
  const unit = PARAM_LABELS[name]?.[1];
  if (typeof value === "boolean") return ONOFF.has(name) ? (value ? "ON" : "OFF") : value ? "sì" : "no";
  if (typeof value === "number") {
    if (ONOFF.has(name)) return value ? "ON" : "OFF";
    const s = Number.isInteger(value) ? value.toLocaleString("it-IT") : value.toLocaleString("it-IT", { maximumFractionDigits: 2 });
    return unit ? `${s} ${unit}` : s;
  }
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "—");
}
