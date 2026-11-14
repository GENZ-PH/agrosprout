import { zValidator } from "@hono/zod-validator";
import type { ZodType } from "zod";

type Target = "json" | "query" | "param" | "header" | "form";

/**
 * Request validation for any route: `validate("query", z.object({ lat: z.coerce.number() }))`.
 * Bad input returns the shared error shape with code "invalid_request".
 */
export const validate = <T extends ZodType, K extends Target>(target: K, schema: T) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { ok: false as const, error: { code: "invalid_request", message: "Invalid request", details: result.error.issues } },
        400,
      );
    }
  });
