import "server-only";

export const env = {
  flespiToken: process.env.FLESPI_TOKEN?.trim() || "",
  databaseUrl: process.env.DATABASE_URL?.trim() || "",
  adminEmail: process.env.ADMIN_EMAIL?.trim() || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",
};

/** Modalità demo: nessun token flespi oppure FLESPI_MOCK=1 */
export const isMock = !env.flespiToken || process.env.FLESPI_MOCK === "1";
