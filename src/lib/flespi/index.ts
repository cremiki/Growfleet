import "server-only";
import { isMock } from "../env";
import * as real from "./client";
import * as mock from "./mock";

/** Sorgente dati: flespi reale oppure simulazione (modalità demo) */
export const fleet = isMock ? mock : real;
export { FlespiError } from "./client";
