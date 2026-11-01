import type { de } from "./de";

export type MessageKey = keyof typeof de;
export type Catalog = { [K in MessageKey]: string };
