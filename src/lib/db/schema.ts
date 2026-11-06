import { boolean, date, doublePrecision, integer, pgSchema, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tutte le tabelle dell'app stanno nello schema Postgres "growfleet":
 * così non si scontrano con tabelle di altre applicazioni nello stesso database.
 */
export const app = pgSchema("growfleet");

/** Un cliente del servizio. I suoi veicoli sono quelli assegnati in customer_devices. */
export const customers = app.table("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Assegnazione dei dispositivi flespi (per ID) ai clienti */
export const customerDevices = app.table(
  "customer_devices",
  {
    customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    deviceId: integer("device_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.deviceId] })],
);

export type Role = "admin" | "customer";

/** Utenti: 'admin' = il tuo team (vede tutto), 'customer' = utente di un cliente (vede solo i veicoli assegnati). */
export const users = app.table("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  blocked: boolean("blocked").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const VEHICLE_TYPES = ["auto", "furgone", "camion", "moto", "macchina", "rimorchio", "persona", "oggetto"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/** Anagrafica del veicolo, collegata al dispositivo flespi tramite il suo ID */
export const vehicles = app.table("vehicles", {
  deviceId: integer("device_id").primaryKey(),
  plate: text("plate"),
  make: text("make"),
  model: text("model"),
  iconText: text("icon_text"),
  type: text("type").$type<VehicleType>(),
  year: integer("year"),
  vin: text("vin"),
  driver: text("driver"),
  fuelType: text("fuel_type"),
  tankL: doublePrecision("tank_l"),
  consumptionL100: doublePrecision("consumption_l100"),
  co2GKm: doublePrecision("co2_g_km"),
  phone: text("phone"),
  notes: text("notes"),
  unavailable: boolean("unavailable").default(false).notNull(),
  speedLimit: integer("speed_limit"),
  ecoSpeed: integer("eco_speed"),
  longStopMin: integer("long_stop_min"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Promemoria di manutenzione e scadenze di documenti, per data, chilometri o ore motore */
export const reminders = app.table("vehicle_reminders", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").notNull(),
  kind: text("kind").$type<"manutenzione" | "documento">().notNull(),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  dueKm: doublePrecision("due_km"),
  dueHours: doublePrecision("due_hours"),
  notes: text("notes"),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Cache degli indirizzi (geocodifica inversa), chiave = "lat,lon" arrotondati a 4 decimali (~10 m) */
export const geocache = app.table("geocache", {
  key: text("key").primaryKey(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type User = typeof users.$inferSelect;
export type VehicleProfile = typeof vehicles.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;

/**
 * Schema SQL equivalente, applicato all'avvio (idempotente).
 * Quando il progetto cresce conviene passare a migrazioni drizzle-kit.
 */
export const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS growfleet;
CREATE TABLE IF NOT EXISTS growfleet.customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS growfleet.customer_devices (
  customer_id INTEGER NOT NULL REFERENCES growfleet.customers(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL,
  PRIMARY KEY (customer_id, device_id)
);
CREATE INDEX IF NOT EXISTS customer_devices_device_idx ON growfleet.customer_devices (device_id);
CREATE TABLE IF NOT EXISTS growfleet.geocache (
  key TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS growfleet.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','customer')),
  customer_id INTEGER REFERENCES growfleet.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE growfleet.users ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE growfleet.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS growfleet.vehicles (
  device_id INTEGER PRIMARY KEY,
  plate TEXT, make TEXT, model TEXT, icon_text TEXT, type TEXT, year INTEGER, vin TEXT, driver TEXT,
  fuel_type TEXT, tank_l DOUBLE PRECISION, consumption_l100 DOUBLE PRECISION, co2_g_km DOUBLE PRECISION,
  phone TEXT, notes TEXT, unavailable BOOLEAN NOT NULL DEFAULT false,
  speed_limit INTEGER, eco_speed INTEGER, long_stop_min INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS growfleet.vehicle_reminders (
  id SERIAL PRIMARY KEY,
  device_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manutenzione','documento')),
  title TEXT NOT NULL,
  due_date DATE, due_km DOUBLE PRECISION, due_hours DOUBLE PRECISION,
  notes TEXT,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicle_reminders_device_idx ON growfleet.vehicle_reminders (device_id);
`;
