// Secrets are set with `wrangler secret put` and never live in wrangler.jsonc, so `wrangler types`
// does not see them. Optional: the route checks for it and answers "not switched on" without it.
interface Env {
  ANTHROPIC_API_KEY?: string;
}
