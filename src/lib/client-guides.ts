export type GuideModel = {
  id: string;
  name: string;
  openai: boolean;
  anthropic: boolean;
  tools?: boolean;
  streaming?: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
};
type Protocol = "anthropic" | "openai" | "either" | "responses";
export type ClientGuide = {
  id: string;
  name: string;
  group: string;
  protocol: Protocol;
  steps: string[];
  note?: string;
};
const agent = "Agents & IDEs",
  chat = "Chat applications",
  api = "Automation & SDK";
const entry = (
  id: string,
  name: string,
  group: string,
  protocol: Protocol,
  steps: string[],
  note?: string,
): ClientGuide => ({ id, name, group, protocol, steps, note });
export const clientGuides: ClientGuide[] = [
  entry(
    "claude-code",
    "Claude Code",
    agent,
    "anthropic",
    [
      "Works for the Claude Code CLI and the VS Code extension. Paste this into ~/.claude/settings.json and run claude.",
      "Restart Claude Code or its IDE extension, then start a new session with the selected model.",
    ],
    "Agent tools must be enabled for this model. Use a new session after changing provider settings.",
  ),
  entry("roo-code", "Roo Code / Cline / Kilo", agent, "anthropic", [
    "Open the extension → Settings → Providers.",
    "Choose API Provider: Anthropic and enable Use custom base URL.",
    "Paste the URL, key, and model from the block below.",
  ]),
  entry(
    "cursor",
    "Cursor",
    agent,
    "openai",
    [
      "Open Cursor Settings → Models → API Keys. Paste your Somiti key into OpenAI API Key, enable it, and save if a Save button appears.",
      "Enable Override OpenAI Base URL and paste the exact base URL below. Keep /v2; do not replace it with /v1 or append /chat/completions.",
      "In Add Custom Model, paste the exact model ID below. Prefer a neutral alias such as sonnet-5 instead of a claude- or anthropic-named model.",
      "Start a new chat and explicitly select your custom model instead of Auto. Send a short message, then check History for a new request.",
    ],
    "Use the OpenAI settings for this connection, including Claude models. Cursor's Anthropic settings do not provide this custom base URL setup.",
  ),
  entry(
    "copilot",
    "GitHub Copilot",
    agent,
    "either",
    [
      "Open Command Palette → Chat: Manage Language Models → Add custom model.",
      "Alternatively, add the configuration below to chatLanguageModels.json.",
      "Choose the added model in the chat model picker.",
    ],
    "You must be signed in to GitHub Copilot; the Free plan is sufficient. On Business/Enterprise, organization policy may disable BYOK.",
  ),
  entry("continue", "Continue.dev", agent, "either", [
    "Open Continue's local config.yaml.",
    "Merge the model entry below into your models list, then reload Continue.",
    "Select Somiti in chat. Enable agent mode only if tools are supported.",
  ]),
  entry("aider", "Aider", agent, "either", [
    "Set the environment variables below in your terminal.",
    "Run the supplied aider command in your project folder.",
  ]),
  entry("codex", "Codex CLI", agent, "responses", [
    "Open ~/.codex/config.toml (Windows: %USERPROFILE%\\.codex\\config.toml). Merge the provider settings below without replacing unrelated settings.",
    "Set SOMITI_API_KEY in your terminal using the command below. Restart Codex from that terminal and select the configured model.",
    "Start a new session and send a short request. Check dashboard History to confirm it used your Somiti key.",
  ]),
  entry("zed", "Zed", agent, "anthropic", [
    "Cmd+, → Open Settings; add the language_models block below.",
    "Agent Panel → Settings → Anthropic → API Key. Paste your Somiti key.",
    "Select the added model.",
  ]),
  entry(
    "opencode",
    "OpenCode",
    agent,
    "either",
    [
      "Create ~/.config/opencode/opencode.json if it does not exist, then merge the configuration below.",
      "Restart OpenCode and select the somiti provider and model.",
    ],
    "This configuration uses the provider schema shown below. Keep any other providers already in your configuration.",
  ),
  entry("jetbrains", "JetBrains AI Assistant", agent, "openai", [
    "Settings → Tools → AI Assistant → Providers & API keys.",
    "Choose OpenAI-compatible, fill in the fields, and click Test Connection.",
    "Select it for AI chat.",
  ]),
  entry("openhands", "OpenHands", agent, "either", [
    "Open Settings → LLM → Advanced.",
    "Set Custom Model to the prefixed model value below; enter the base URL and API key.",
    "Save before starting a session.",
  ]),
  entry("goose", "Goose", agent, "anthropic", [
    "Set the environment variables below, then run goose configure.",
    "Choose Anthropic and use the exact model ID below.",
  ]),
  entry("crush", "Crush", agent, "anthropic", [
    "Declare Somiti as a new provider in crush.json.",
    "Use the new somiti provider ID; do not overwrite the built-in anthropic provider.",
  ]),
  entry("droid", "Droid (Factory)", agent, "either", [
    "Merge the customModels entry into ~/.factory/settings.json.",
    "Use settings.json with camelCase. Restart Droid and select the custom model; the legacy config.json does not interpolate environment variables.",
  ]),
  entry("openclaw", "OpenClaw", agent, "either", [
    "Add a custom provider to ~/.openclaw/openclaw.json. Use the new somiti provider name instead of overriding anthropic or openai.",
    "Merge the configuration below and keep the model ID exactly as shown in this dashboard's model list.",
    "If agents.defaults.models is set anywhere in your config, it acts as an allowlist — add somiti/<model-id> there too, or you will get a model not allowed error.",
    "Restart OpenClaw after saving and select the configured default model.",
  ]),
  entry("void", "Void", agent, "openai", [
    "Settings → Providers → OpenAI-Compatible; add the model manually.",
    "Enter the Endpoint, API Key, and Model from the fields below.",
    "Select the model in chat.",
  ]),
  entry("editors-misc", "gptel / avante.nvim", agent, "anthropic", [
    "Ready-to-use configurations for Emacs gptel and Neovim avante.nvim.",
    "For Emacs, add the backend below to init.el and select Somiti in gptel.",
    "For Neovim, merge the claude provider below into your avante.nvim setup. Run the terminal environment command before opening Neovim.",
  ]),
  entry(
    "open-webui",
    "Open WebUI",
    chat,
    "openai",
    [
      "Admin Panel → Settings → Connections → OpenAI API → +.",
      "Fill in Base URL and the key, then click Save. Refresh the model list to discover available models automatically.",
      "Select the model in a new chat.",
    ],
    "Use a separate embedding provider for document search; Somiti has no embeddings endpoint.",
  ),
  entry("librechat", "LibreChat", chat, "openai", [
    "Add Somiti as a custom endpoint in librechat.yaml. fetch: true loads the available models from your assigned route.",
    "Restart LibreChat and select Somiti. Automatic conversation titles use the selected model and make additional billable requests.",
  ]),
  entry("sillytavern", "SillyTavern", chat, "either", [
    "Open API Connections and choose Chat Completion.",
    "Choose Source: Custom (OpenAI-compatible) when the Provider below is OpenAI-compatible. For an Anthropic-only model, choose Source: Claude and use the Reverse Proxy URL and Proxy Password below.",
    "Fill in the fields below and click Connect.",
    "If a new Sonnet/Opus returns 400, reset temperature and top_p to their defaults.",
  ]),
  entry("chatbox", "Chatbox", chat, "either", [
    "Open Settings → Model Provider.",
    "Choose Claude (Anthropic) for an Anthropic model, or an OpenAI-compatible provider for a chat-completions model. Follow the Provider field below.",
    "Set the API host, key, and model, then save.",
  ]),
  entry("lobechat", "LobeChat", chat, "anthropic", [
    "Open Settings → Language Models → Anthropic.",
    "Set API Proxy Address and API Key using the fields below. If the model does not appear, add its ID to Model List manually.",
    "Enable the model and start a chat.",
  ]),
  entry("cherry", "Cherry Studio", chat, "either", [
    "Open Settings → Model Providers and add a new provider.",
    "Choose Anthropic for messages or OpenAI for chat completions (not OpenAI Responses).",
    "Set the API host and key, add the exact model ID, and enable the provider.",
  ]),
  entry("jan", "Jan", chat, "openai", [
    "Settings → Model Providers → Add Provider (OpenAI-compatible).",
    "Enter the API URL and key, then add the model ID.",
    "Use that remote model in chat.",
  ]),
  entry("msty", "Msty", chat, "openai", [
    "Settings → Remote Model Providers → Add → Open AI Compatible.",
    "Enter the base URL and API key; fetch models or add the ID manually.",
    "Select the model for a conversation.",
  ]),
  entry(
    "typingmind",
    "TypingMind",
    chat,
    "openai",
    [
      "Settings → Models → Custom Models → Add; enable Streaming.",
      "Use the full chat-completions URL below, not just the base URL.",
      "Set the API key and model ID, then test.",
    ],
    "A browser-only client may require CORS support. Use a server-side connection if the browser blocks the request.",
  ),
  entry("obsidian", "Obsidian Copilot", chat, "openai", [
    "Copilot Settings → Model → Add Custom Model.",
    "Choose 3rd party (openai format) and set the Base URL, API Key, and Model below.",
    "Select the model for chat. Configure embeddings separately for vault search.",
  ]),
  entry(
    "raycast",
    "Raycast AI",
    chat,
    "openai",
    [
      "Raycast → AI Settings → Reveal Providers Config.",
      "Merge the custom provider below into providers.yaml.",
      "Reload providers and select Somiti.",
    ],
    "Requires Raycast's custom-provider feature; a regular API-key-only form cannot change the API host.",
  ),
  entry("hermes", "Hermes", chat, "openai", [
    "Run hermes model, choose Custom endpoint, then enter the values below.",
    "Choose Chat Completions. If the interactive setup does not work, merge the two files below into your existing configuration.",
    "Restart Hermes after saving. Do not choose Anthropic OAuth for this key.",
  ]),
  entry(
    "claude-desktop",
    "Claude Desktop",
    chat,
    "anthropic",
    [
      "Enable developer mode: Settings → Help → Troubleshooting → Enable Developer Mode.",
      "Open Settings → Developer → Configure Third-Party Inference. Under Connection choose Gateway, and set Credential kind to Static API key.",
      "Enter the gateway settings below, click Test connection → Apply Changes.",
    ],
  ),
  entry("n8n", "n8n", api, "either", [
    "Add an Anthropic or OpenAI credential matching the selected protocol.",
    "Set its custom Base URL and key. If the credential has no URL override, use an HTTP Request node with the full endpoint below.",
    "Choose the exact model ID in the model node.",
  ]),
  entry("litellm", "LiteLLM", api, "either", [
    "Add the model entry below to your LiteLLM proxy configuration.",
    "Restart the proxy and send requests using the configured model_name.",
  ]),
  entry("dify", "Dify", api, "either", [
    "Open Settings → Model Provider.",
    "Configure Anthropic for messages or an OpenAI-API-compatible provider for chat completions.",
    "Enter the custom URL, API key, and exact model ID, then add it to your application.",
  ]),
  entry("flowise", "Flowise", api, "openai", [
    "Add a ChatOpenAI Custom or ChatLocalAI node.",
    "Set Base Path to the URL below; attach an API-key credential and enter the model ID.",
    "Connect the node to your flow and save.",
  ]),
  entry("sdk", "SDK", api, "either", [
    "Install the SDK matching your selected protocol.",
    "Run the Python or TypeScript example on your server. Keep the key outside public frontend code.",
  ]),
  entry("openai-compat", "OpenAI-compatible", api, "openai", [
    "Choose a client that supports a custom OpenAI-compatible base URL.",
    "Enter the base URL, key, and model ID below. Use chat completions, not Responses.",
  ]),
  entry("api", "API / curl", api, "either", [
    "Choose your operating system below.",
    "Copy the request into your terminal. It makes a real request and consumes account quota.",
  ]),
  entry("capabilities", "Capabilities & FAQ", api, "either", [
    "Messages, chat completions, streaming, and model discovery are routed according to each model's enabled capabilities.",
    "Responses, Messages, Chat Completions, token counting, and Responses compaction use your assigned route. Embeddings, audio, file uploads, and image-generation endpoints are not implemented.",
    "A model supporting one protocol is not automatically available through the other. Use the compatible model picker.",
    "Agent tools, reasoning, and image input must be enabled for the model by the administrator. No application has been generation-tested by these instructions.",
  ]),
];
export function compatibleModels(guide: ClientGuide, models: GuideModel[]) {
  const compatible = models.filter((m) =>
    guide.protocol === "anthropic"
      ? m.anthropic
      : guide.protocol === "openai"
        ? m.openai
        : guide.protocol === "responses"
          ? m.openai || m.anthropic
          : m.openai || m.anthropic,
  );
  if (guide.id === "cursor") {
    const neutral = compatible.filter(
      (m) => !/(^|\/)(claude-|anthropic-)/i.test(m.id),
    );
    return neutral.length ? neutral : compatible;
  }
  return compatible;
}
export function connectionGuide(
  guide: ClientGuide,
  model: GuideModel,
  baseUrl: string,
  key: string,
  os: "unix" | "windows",
) {
  const base = baseUrl.replace(/\/$/, "");
  const a =
    guide.protocol === "anthropic" ||
    (guide.protocol === "either" && model.anthropic && !(guide.id === "sillytavern" && model.openai));
  const protocol = a ? "anthropic" : "openai";
  const id = model.id;
  const q = (v: unknown) => JSON.stringify(v, null, 2);
  const env = (values: Record<string, string>) =>
    Object.entries(values)
      .map(([k, v]) =>
        os === "windows"
          ? `$env:${k} = '${v.replaceAll("'", "''")}'`
          : `export ${k}='${v.replaceAll("'", "'\\''")}'`,
      )
      .join("\n");
  const endpoint = `${base}/${guide.protocol === "responses" ? "responses" : a ? "messages" : "chat/completions"}`;
  const snippets: { title: string; code: string }[] = [];
  const add = (title: string, value: unknown) =>
    snippets.push({
      title,
      code: typeof value === "string" ? value : q(value),
    });
  const fields = [
    {
      label: "Provider",
      value: a
        ? "Anthropic / Messages"
        : "OpenAI-compatible / Chat Completions",
    },
    {
      label: guide.id === "cursor" ? "Override OpenAI Base URL" : "Base URL",
      value:
        guide.id === "typingmind"
          ? endpoint
          : guide.id === "sillytavern" && a
            ? `${base}/v1`
            : base,
    },
    { label: guide.id === "cursor" ? "OpenAI API Key" : "API key", value: key },
    {
      label: guide.id === "cursor" ? "Custom model ID" : "Model ID",
      value: id,
    },
  ];
  const vars: Record<string, string> = a
    ? { ANTHROPIC_BASE_URL: base, ANTHROPIC_API_KEY: key }
    : { OPENAI_API_BASE: base, OPENAI_API_KEY: key };
  switch (guide.id) {
    case "copilot":
      add("chatLanguageModels.json", [{name: "Somiti", vendor: "customendpoint", apiKey: key, apiType: a ? "messages" : "chatCompletions", models: [{id, url: base}]}]);
      break;
    case "codex":
      {
        const quote = (v: string) => os === "windows" ? "'" + v.replaceAll("'", "''") + "'" : "'" + v.replaceAll("'", "'\\''") + "'";
        const overrides = { model_provider: "somiti", "model_providers.somiti.name": "Somiti", "model_providers.somiti.base_url": base, "model_providers.somiti.env_key": "SOMITI_API_KEY", "model_providers.somiti.wire_api": "responses", "model_providers.somiti.requires_openai_auth": false, "model_providers.somiti.supports_websockets": false };
        add(os === "windows" ? "Quick start · PowerShell (current session)" : "Quick start · macOS / Linux (current session)", env({SOMITI_API_KEY:key}) + "\ncodex --model " + quote(id) + Object.entries(overrides).map(([k,v]) => " -c " + quote(k + "=" + JSON.stringify(v))).join(""));
      }
      add(
        "~/.codex/config.toml",
        `model_provider = "somiti"\nmodel = ${q(id)}\ndisable_response_storage = true\n\n[model_providers.somiti]\nname = "Somiti"\nbase_url = ${q(base)}\nenv_key = "SOMITI_API_KEY"\nwire_api = "responses"\nrequires_openai_auth = false\nsupports_websockets = false`,
      );
      add(
        os === "windows" ? "PowerShell" : "macOS / Linux",
        `${env({ SOMITI_API_KEY: key })}\ncodex`,
      );
      break;
    case "claude-code": {
      const values = {
        ANTHROPIC_BASE_URL: base,
        ANTHROPIC_AUTH_TOKEN: key,
        ANTHROPIC_MODEL: id,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
      };
      add("~/.claude/settings.json", { env: values });
      add(
        os === "windows" ? "PowerShell" : "macOS / Linux",
        `${env(values)}\nclaude`,
      );
      break;
    }
    case "continue":
      add(
        "config.yaml",
        `name: Somiti\nversion: 1.0.0\nschema: v1\nmodels:\n  - name: Somiti\n    provider: ${protocol}\n    model: ${q(id)}\n    apiBase: ${q(a ? base + "/v1" : base)}\n    apiKey: ${q(key)}\n    roles: [chat, edit, apply]`,
      );
      break;
    case "aider":
      add("Terminal", `${env(a ? { ANTHROPIC_API_BASE: base, ANTHROPIC_API_KEY: key } : vars)}\naider --model ${protocol}/${id}`);
      break;
    case "goose":
      add("~/.config/goose/config.yaml", `GOOSE_PROVIDER: anthropic\nGOOSE_MODEL: ${q(id)}`);
      add(
        "Terminal",
        `${env({ ANTHROPIC_HOST: base, ANTHROPIC_API_KEY: key, GOOSE_MODEL: id })}\ngoose configure`,
      );
      break;
    case "zed":
      add("settings.json", {
        language_models: {
          anthropic: {
            api_url: base,
            available_models: [
              {
                name: id,
                display_name: model.name,
                max_tokens: model.contextWindow ?? 32768,
              },
            ],
          },
        },
      });
      break;
    case "opencode":
      add("~/.config/opencode/opencode.json", {
        $schema: "https://opencode.ai/config.json",
        provider: {
          somiti: {
            npm: a ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible",
            name: "Somiti",
            options: { baseURL: a && base.endsWith("/v2") ? `${base}/v1` : base, apiKey: key },
            models: { [id]: { name: model.name } },
          },
        },
        model: `somiti/${id}`,
      });
      break;
    case "crush":
      add("crush.json", {
        providers: {
          somiti: {
            name: "Somiti",
            type: "anthropic",
            base_url: base,
            api_key: key,
            models: [
              {
                id,
                name: model.name,
                context_window: model.contextWindow ?? 32768,
              },
            ],
          },
        },
      });
      break;
    case "droid":
      add("~/.factory/settings.json", {
        customModels: [
          {
            model: id,
            displayName: model.name,
            provider: a ? "anthropic" : "generic-chat-completion-api",
            baseUrl: base,
            apiKey: key,
          },
        ],
      });
      break;
    case "openclaw":
      add("~/.openclaw/openclaw.json", {
        agents: { defaults: { model: { primary: `somiti/${id}` } } },
        models: {
          mode: "merge",
          providers: {
            somiti: {
              baseUrl: base,
              apiKey: key,
              api: a ? "anthropic-messages" : "openai-completions",
              models: [
                {
                  id,
                  name: model.name,
                  contextWindow: model.contextWindow ?? 32768,
                },
              ],
            },
          },
        },
      });
      break;
    case "openhands":
      add("Docker environment", `LLM_MODEL=${protocol}/${id}\nLLM_BASE_URL=${base}\nLLM_API_KEY=${key}`);
      fields[3] = { label: "Custom Model", value: `${protocol}/${id}` };
      add(
        "Terminal environment",
        `${env({ LLM_MODEL: `${protocol}/${id}`, LLM_BASE_URL: base, LLM_API_KEY: key })}`,
      );
      break;
    case "editors-misc": {
      const url = new URL(base);
      add(
        "Emacs init.el",
        `(setq gptel-backend\n  (gptel-make-anthropic "Somiti"\n    :host ${q(url.host)}\n    :protocol ${q(url.protocol.slice(0, -1))}\n    :endpoint ${q(url.pathname + "/messages")}\n    :key ${q(key)}\n    :stream t\n    :models '(${id})))`,
      );
      add(
        "avante.nvim setup",
        `providers = {\n  claude = {\n    endpoint = ${q(base)},\n    model = ${q(id)},\n    api_key_name = "ANTHROPIC_API_KEY",\n  },\n}`,
      );
      add("Terminal", env({ ANTHROPIC_API_KEY: key }));
      break;
    }
    case "librechat":
      add(
        "librechat.yaml",
        `endpoints:\n  custom:\n    - name: Somiti\n      baseURL: ${q(base)}\n      apiKey: ${q(key)}\n      models:\n        default: [${q(id)}]\n        fetch: true\n      titleConvo: true\n      titleModel: ${q(id)}`,
      );
      break;
    case "lobechat":
      add("Self-hosted environment", `ANTHROPIC_API_KEY=${key}\nANTHROPIC_PROXY_URL=${base}`);
      break;
    case "raycast":
      add(
        "providers.yaml",
        `providers:\n  - id: somiti\n    name: Somiti\n    base_url: ${q(base)}\n    api_keys:\n      openai: ${q(key)}\n    models:\n      - id: ${q(id)}\n        name: ${q(model.name)}${model.contextWindow ? `\n        context: ${model.contextWindow}` : ""}\n        abilities:\n          temperature:\n            supported: false`,
      );
      break;
    case "hermes":
      add("~/.hermes/config.yaml", `model:\n  provider: custom\n  default: ${q(id)}\n  base_url: ${q(base)}\n  api_mode: chat_completions`);
      add("~/.hermes/.env", `OPENAI_API_KEY=${key}`);
      break;
    case "litellm":
      add(
        "config.yaml",
        `model_list:\n  - model_name: ${q(id)}\n    litellm_params:\n      model: ${q(protocol + "/" + id)}\n      api_base: ${q(base)}\n      api_key: ${q(key)}`,
      );
      break;
    case "sdk":
      add(
        "Python",
        a
          ? `from anthropic import Anthropic\n\nclient = Anthropic(base_url=${q(base)}, api_key=${q(key)})\nprint(client.messages.create(model=${q(id)}, max_tokens=1024, messages=[{"role":"user","content":"Hello"}]))`
          : `from openai import OpenAI\n\nclient = OpenAI(base_url=${q(base)}, api_key=${q(key)})\nprint(client.chat.completions.create(model=${q(id)}, messages=[{"role":"user","content":"Hello"}]))`,
      );
      add(
        "TypeScript",
        a
          ? `import Anthropic from "@anthropic-ai/sdk";\nconst client = new Anthropic({baseURL:${q(base)},apiKey:${q(key)}});\nconsole.log(await client.messages.create({model:${q(id)},max_tokens:1024,messages:[{role:"user",content:"Hello"}]}));`
          : `import OpenAI from "openai";\nconst client = new OpenAI({baseURL:${q(base)},apiKey:${q(key)}});\nconsole.log(await client.chat.completions.create({model:${q(id)},messages:[{role:"user",content:"Hello"}]}));`,
      );
      break;
    case "api":
    case "openai-compat": {
      const headers: Record<string, string> = a
        ? {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          }
        : {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          };
      const payload = q({
        model: id,
        ...(a ? { max_tokens: 1024 } : {}),
        messages: [{ role: "user", content: "Hello" }],
      });
      add(
        os === "windows" ? "PowerShell" : "cURL",
        os === "windows"
          ? `$headers = @{${Object.entries(headers)
              .map(([k, v]) => `'${k}' = '${v.replaceAll("'", "''")}'`)
              .join(
                "; ",
              )}}\n$body = @'\n${payload}\n'@\nInvoke-RestMethod -Uri '${endpoint}' -Method Post -Headers $headers -Body $body`
          : `curl '${endpoint}' \\\n${Object.entries(headers)
              .map(([k, v]) => `  -H '${k}: ${v.replaceAll("'", "'\\''")}' \\`)
              .join("\n")}\n  -d '${payload}'`,
      );
      break;
    }
  }
  if (guide.id === "roo-code") return {fields: [{label:"API Provider",value:"Anthropic"},{label:"Anthropic API Key",value:key},{label:"Custom base URL",value:base},{label:"Model",value:id}],snippets,endpoint,protocol};
  if (guide.id === "claude-desktop") return { fields: [{label: "Gateway base URL", value: base}, {label: "Gateway API key", value: key}, {label: "Gateway auth scheme", value: "x-api-key"}], snippets: [], endpoint, protocol };
  const clientFields: Record<string, {label: string; value: string}[]> = {
    cherry: [{label: "Provider", value: a ? "Anthropic" : "OpenAI"}, {label: "API host", value: base}, {label: "API key", value: key}, {label: "Model", value: id}],
    jan: [{label: "Base URL", value: base}, {label: "API Key", value: key}, {label: "Model", value: id}],
    msty: [{label: "Endpoint", value: base}, {label: "API Key", value: key}, {label: "Model", value: id}],
    typingmind: [{label: "Endpoint", value: endpoint}, {label: "API Key", value: key}, {label: "Model ID", value: id}],
    obsidian: [{label: "Provider", value: "3rd party (openai format)"}, {label: "Base URL", value: base}, {label: "API Key", value: key}, {label: "Model", value: id}],
    hermes: [{label: "Base URL", value: base}, {label: "API key", value: key}, {label: "API compatibility / transport", value: "Chat Completions"}, {label: "Model", value: id}],
    void: [{label: "Endpoint", value: base}, {label: "API Key", value: key}, {label: "Model", value: id}],
    "open-webui": [{label: "API Base URL", value: base}, {label: "API Key", value: key}],
    sillytavern: [{label: "Provider", value: a ? "Claude" : "Custom (OpenAI-compatible)"}, {label: a ? "Reverse Proxy URL" : "Custom Endpoint (Base URL)", value: a ? `${base}/v1` : base}, {label: a ? "Proxy Password" : "API Key", value: key}, {label: "Model", value: id}],
    chatbox: [{label: "Provider", value: a ? "Claude (Anthropic)" : "OpenAI-compatible"}, {label: "API Host", value: base}, {label: "API Key", value: key}, {label: "Model", value: id}],
    lobechat: [{label: "API Key", value: key}, {label: "API Proxy Address", value: base}, {label: "Model", value: id}],
  };
  return { fields: clientFields[guide.id] ?? fields, snippets, endpoint, protocol };
}
