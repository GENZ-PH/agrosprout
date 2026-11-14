// Lets `node --test` run our TypeScript tests with no extra dependency.
// Node 24 strips TypeScript types natively, but Node's ESM resolver needs
// file extensions, while Metro and tsc (the app) use extensionless imports
// like `./et0`. This hook retries a relative extensionless import with `.ts`.
// Used by `npm test` (see package.json).
import { registerHooks } from "node:module";

const RELATIVE = /^\.{1,2}\//;
const HAS_EXT = /\.[cm]?[jt]sx?$|\.json$/;

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (
        err?.code === "ERR_MODULE_NOT_FOUND" &&
        RELATIVE.test(specifier) &&
        !HAS_EXT.test(specifier)
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw err;
    }
  },
});
