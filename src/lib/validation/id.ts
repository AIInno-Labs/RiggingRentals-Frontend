import { z } from "zod";

/** Postgres uuid columns accept any 8-4-4-4-12 hex; Zod `.uuid()` requires RFC version/variant bits and rejects demo seed ids. */
export const zId = z.string().guid();
