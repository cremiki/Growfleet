import { integer, pgSchema, primaryKey, serial, text, timestamp } from "drizzle-orm/pg-core";

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Customer = typeof customers.$inferSelect;
export type User = typeof users.$inferSelect;

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
CREATE TABLE IF NOT EXISTS growfleet.users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','customer')),
  customer_id INTEGER REFERENCES growfleet.customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
