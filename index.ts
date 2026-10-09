/**
 * modealias: registers provider "modealias" whose models are aliases of other
 * models, each with its own limits, cost and thinking levels. Streaming is
 * delegated to the target through the model registry, which resolves the
 * target provider's own auth.
 *
 * Config <agent dir>/modealias.json:
 *   { "aliases": [ {
 *       "id": "gcp_sonnet-5.5_500",
 *       "name": "Sonnet 5.5 (GCP, 500k)",
 *       "target": "anthropic-vertex/claude-sonnet-5-5",   // provider/model, split at first "/"
 *       "reasoning": true, "input": ["text", "image"],
 *       "contextWindow": 500000, "maxTokens": 128000,
 *       "cost": { "input": 2, "output": 10, "cacheRead": 0.2, "cacheWrite": 2.5 },
 *       "thinkingLevelMap": { "xhigh": null, "max": null }
 *   } ] }
 * Limits (fail loudly, never clamp silently):
 *   - thinkingLevelMap null hides a level in the picker; pi itself clamps a
 *     level requested via /thinking, but "--thinking L" / "--model alias:L" on
 *     the command line naming an unsupported level aborts startup here.
 *   - contextWindow is a hard cap: a request whose estimated size (JSON chars
 *     / 4, deliberately coarse) exceeds it is rejected before it is sent.
 *     Set "enforceContextWindow": false on an alias for the soft
 *     (compaction-only) behaviour.
 * Metadata is explicit because the target's catalog is not yet loaded when
 * pi resolves models at startup. Optional model fields (promptCache, compat,
 * inputLimits, headers) are passed through; compat is merged over the target's.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai/compat";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type Alias = { id: string; name?: string; target: string; [field: string]: any };

export function validateAliases(raw: any, path: string): Alias[] {
  const aliases = raw?.aliases;
  if (!Array.isArray(aliases)) throw new Error(`${path}: "aliases" must be an array`);
  const seen = new Set<string>();
  for (const a of aliases) {
    if (!a.id || !a.target?.includes("/")) throw new Error(`${path}: alias needs id and provider/model target`);
    if (seen.has(a.id)) throw new Error(`${path}: duplicate alias id "${a.id}"`);
    seen.add(a.id);
    if (a.target.startsWith("modealias/")) throw new Error(`${path}: alias ${a.id} must not target another alias`);
    for (const field of ["contextWindow", "maxTokens"]) {
      if (!(a[field] > 0)) throw new Error(`${path}: alias ${a.id} needs a positive "${field}"`);
    }
  }
  return aliases;
}

function loadAliases(): Alias[] {
  const path = join(getAgentDir(), "modealias.json");
  return validateAliases(JSON.parse(readFileSync(path, "utf8")), path);
}

// Levels pi will pass through for this alias (same rule pi uses for its picker).
function supportedLevels(alias: Alias): string[] {
  return getSupportedThinkingLevels({ reasoning: alias.reasoning ?? false, thinkingLevelMap: alias.thinkingLevelMap } as any);
}

// Fail when the command line explicitly asks an alias for an unsupported level.
export function assertRequestedLevelSupported(byId: Map<string, Alias>, argv: string[] = process.argv) {
  const flag = (name: string) => argv[argv.indexOf(name) + 1];
  const model: string | undefined = argv.includes("--model") ? flag("--model") : undefined;
  if (!model) return;
  const [ref, inlineLevel] = model.split(/:(?=[a-z]+$)/);
  const alias = byId.get(ref.replace(/^modealias\//, ""));
  const level = (argv.includes("--thinking") ? flag("--thinking") : undefined) ?? inlineLevel;
  if (alias && level && !supportedLevels(alias).includes(level)) {
    throw new Error(`modealias: ${alias.id} does not support thinking level "${level}" (supported: ${supportedLevels(alias).join(", ")})`);
  }
}

export default function (pi: ExtensionAPI) {
  let registry: any; // captured at session_start; always set before any stream
  const aliases = loadAliases();
  const byId = new Map(aliases.map((a) => [a.id, a]));
  assertRequestedLevelSupported(byId);

  // Target model: exact catalog entry, else any model of the target provider
  // (supplies api, baseUrl, compat), with the alias metadata and real id on top.
  function targetModel(alias: Alias) {
    const i = alias.target.indexOf("/");
    const provider = alias.target.slice(0, i);
    const modelId = alias.target.slice(i + 1);
    const base = registry.find(provider, modelId) ?? registry.getAll().find((m: any) => m.provider === provider);
    if (!base) throw new Error(`modealias: target provider "${provider}" has no models (alias ${alias.id})`);
    const { target: _t, name: _n, enforceContextWindow: _e, ...meta } = alias;
    return { ...base, ...meta, id: modelId, provider, name: modelId, compat: { ...base.compat, ...alias.compat } };
  }

  pi.registerProvider("modealias", {
    baseUrl: "http://modealias.invalid",
    apiKey: "modealias", // dummy: makes models selectable; real auth is the target's
    api: "modealias" as any,
    // api/baseUrl are target-side (see targetModel); they must not select the alias's own transport
    models: aliases.map(({ target: _t, api: _a, baseUrl: _b, enforceContextWindow: _e, ...m }) => ({ ...m, name: m.name ?? m.id }) as any),
    streamSimple: (model, context, options) => {
      const alias = byId.get(model.id)!;
      if (alias.enforceContextWindow !== false) {
        const estimatedTokens = Math.ceil(JSON.stringify(context).length / 4);
        if (estimatedTokens > alias.contextWindow) {
          throw new Error(`modealias: ${alias.id} request is ~${estimatedTokens} tokens, over its ${alias.contextWindow} limit`);
        }
      }
      const { apiKey: _dummy, ...rest } = options ?? ({} as any); // let target resolve its own key
      return registry.streamSimple(targetModel(alias), context, rest);
    },
  });

  pi.on("session_start", (_event, ctx) => {
    registry = ctx.modelRegistry;
  });
}
