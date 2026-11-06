import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Un cliente del servizio. Corrisponde a un subaccount flespi (flespi_cid). */
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  flespiCid: integer("flespi_cid").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Role = "admin" | "customer";

/** Utenti: 'admin' = il tuo team (vede tutto), 'customer' = utente di un cliente (vede solo il suo subaccount). */
export const users = pgTable("users", {
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
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  flespi_cid INTEGER UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','customer')),
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
