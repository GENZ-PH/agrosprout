// Secrets are set with `wrangler secret put` and never live in wrangler.jsonc, so `wrangler types`
// does not see them. Optional: the route checks for it and answers "not switched on" without it.
interface Env {
  ANTHROPIC_API_KEY?: string;
  /** NASA Earthdata Login user token (bearer) for Earthdata cloud OPeNDAP (IMERG, FLDAS, SMAP). */
  EARTHDATA_TOKEN?: string;
  /** NASA Earthdata Login username and password, for AppEEARS /login (it takes Basic auth, not the token). */
  EARTHDATA_USER?: string;
  EARTHDATA_PASS?: string;
}
