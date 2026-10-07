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
      "Merge the env block below into ~/.claude/settings.json (Windows: %USERPROFILE%\\.claude\\settings.json).",
      "Restart Claude Code or its IDE extension, then start a new session with the selected model.",
    ],
    "Agent tools must be enabled for this model. Token counting and some advanced gateway features are not supported.",
  ),
  entry("roo-code", "Roo Code / Cline / Kilo", agent, "anthropic", [
    "Open the extension settings and select the Anthropic provider.",
    "Turn on the custom base URL option. Enter the connection fields below and choose the exact model ID.",
    "Save and start a new task.",
  ]),
  entry(
    "cursor",
    "Cursor",
    agent,
    "openai",
    [
      "Open Settings → Models and configure an OpenAI API key.",
      "Enable Override OpenAI Base URL and enter the URL below. Add the model ID manually.",
      "Select that model in chat.",
    ],
    "This configures compatible chat requests; subscription features and autocomplete may use separate services.",
  ),
  entry(
    "copilot",
    "GitHub Copilot",
    agent,
    "openai",
    [
      "In VS Code, run Chat: Manage Language Models from the command palette.",
      "Add a custom OpenAI-compatible endpoint using the fields below.",
      "Choose the added model in the chat model picker.",
    ],
    "Requires a VS Code version with custom endpoint support. Organization policies may restrict custom models.",
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
    "Codex CLI requires the Responses API.",
    "Somiti currently exposes chat completions and messages only. Use another compatible client until Responses support is implemented.",
  ]),
  entry("zed", "Zed", agent, "anthropic", [
    "Merge the language_models block below into Zed settings.json.",
    "In the Agent panel, open model settings and save your Somiti key under Anthropic.",
    "Select the added model.",
  ]),
  entry(
    "opencode",
    "OpenCode",
    agent,
    "either",
    [
      "For OpenCode v1, merge the custom provider below into opencode.json.",
      "Restart OpenCode and select the somiti provider and model.",
    ],
    "This example uses the v1 provider configuration schema; v2 installations use a different schema.",
  ),
  entry("jetbrains", "JetBrains AI Assistant", agent, "openai", [
    "Open Settings → Tools → AI Assistant → Providers & API keys.",
    "Add an OpenAI-compatible provider, fill in the fields below, and test the connection.",
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
    "Merge the provider below into crush.json.",
    "Start Crush and select the Somiti provider and model.",
  ]),
  entry("droid", "Droid (Factory)", agent, "either", [
    "Merge the customModels entry into ~/.factory/settings.json.",
    "Restart Droid and select the new custom model.",
  ]),
  entry("openclaw", "OpenClaw", agent, "either", [
    "Merge the models.providers entry below into ~/.openclaw/openclaw.json.",
    "Restart OpenClaw, then select somiti followed by the exact model ID.",
    "Run openclaw models status --probe to check the connection.",
  ]),
  entry("void", "Void", agent, "openai", [
    "Open Settings → Providers → OpenAI-Compatible.",
    "Enter the URL and key; manually add the model ID below.",
    "Select the model in chat.",
  ]),
  entry("editors-misc", "gptel / avante.nvim", agent, "anthropic", [
    "For Emacs, add the gptel backend below to init.el and select it in gptel.",
    "For Neovim, merge the claude provider below into your avante.nvim setup and set ANTHROPIC_API_KEY before opening Neovim.",
  ]),
  entry(
    "open-webui",
    "Open WebUI",
    chat,
    "openai",
    [
      "Open Admin Panel → Settings → Connections and add an OpenAI connection.",
      "Save the URL and key below, then refresh the model list.",
      "Select the model in a new chat.",
    ],
    "Use a separate embedding provider for document search; Somiti has no embeddings endpoint.",
  ),
  entry("librechat", "LibreChat", chat, "openai", [
    "Merge the custom endpoint below into librechat.yaml.",
    "Restart LibreChat and select Somiti.",
  ]),
  entry("sillytavern", "SillyTavern", chat, "either", [
    "Open API Connections and choose Chat Completion.",
    "For a messages model choose Claude and use its reverse proxy settings. For a chat-completions model choose Custom (OpenAI-compatible).",
    "Enter the fields below, connect, and choose the exact model ID.",
  ]),
  entry("chatbox", "Chatbox", chat, "either", [
    "Open Settings → Model Provider.",
    "Choose Claude/Anthropic for messages, or an OpenAI-compatible provider for chat completions.",
    "Set the API host, key, and model, then save.",
  ]),
  entry("lobechat", "LobeChat", chat, "anthropic", [
    "Open Settings → Language Models → Anthropic.",
    "Set the proxy address and API key; add the model ID if it is absent.",
    "Enable the model and start a chat.",
  ]),
  entry("cherry", "Cherry Studio", chat, "either", [
    "Open Settings → Providers and add a provider.",
    "Choose Anthropic for messages or OpenAI for chat completions (not OpenAI Responses).",
    "Set the API host and key, add the exact model ID, and enable the provider.",
  ]),
  entry("jan", "Jan", chat, "openai", [
    "Open Settings → Model Providers and add an OpenAI-compatible remote provider.",
    "Enter the API URL and key, then add the model ID.",
    "Use that remote model in chat.",
  ]),
  entry("msty", "Msty", chat, "openai", [
    "Open the remote model/provider settings and add OpenAI Compatible.",
    "Enter the base URL and API key; fetch models or add the ID manually.",
    "Select the model for a conversation.",
  ]),
  entry(
    "typingmind",
    "TypingMind",
    chat,
    "openai",
    [
      "Open model settings and add a custom model.",
      "Use the full chat-completions URL below, not just the base URL.",
      "Set the API key and model ID, then test.",
    ],
    "A browser-only client may require CORS support. Use a server-side connection if the browser blocks the request.",
  ),
  entry("obsidian", "Obsidian Copilot", chat, "openai", [
    "Open Obsidian Settings → Copilot → Models and add a custom model.",
    "Choose OpenAI-compatible and set the URL, key, and model ID.",
    "Select the model for chat. Configure embeddings separately for vault search.",
  ]),
  entry(
    "raycast",
    "Raycast AI",
    chat,
    "openai",
    [
      "Open AI settings and use Reveal Providers Config if available.",
      "Merge the custom provider below into providers.yaml.",
      "Reload providers and select Somiti.",
    ],
    "Requires Raycast's custom-provider feature; a regular API-key-only form cannot change the API host.",
  ),
  entry("hermes", "Hermes", chat, "openai", [
    "Open the model/provider configuration and select a custom OpenAI-compatible endpoint.",
    "Choose Chat Completions and enter the fields below.",
    "Save and restart your session.",
  ]),
  entry(
    "claude-desktop",
    "Claude Desktop",
    chat,
    "anthropic",
    [
      "If your managed Desktop installation offers a gateway connection, enter the Somiti URL and key there using x-api-key authentication.",
      "If there is no custom gateway setting, use Claude Code or another client listed here.",
    ],
    "This is not a general replacement for a Claude subscription login. Desktop gateway setup depends on the installed version and organization policy.",
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
    "Responses, token-counting, embeddings, audio, and image-generation endpoints are not implemented.",
    "A model supporting one protocol is not automatically available through the other. Use the compatible model picker.",
    "Agent tools, reasoning, and image input must be enabled for the model by the administrator. No application has been generation-tested by these instructions.",
  ]),
];
export function compatibleModels(guide: ClientGuide, models: GuideModel[]) {
  return models.filter((m) =>
    guide.protocol === "anthropic"
      ? m.anthropic
      : guide.protocol === "openai"
        ? m.openai
        : guide.protocol === "responses"
          ? false
          : m.openai || m.anthropic,
  );
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
    (guide.protocol === "either" && model.anthropic && !model.openai);
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
  const endpoint = `${base}/${a ? "messages" : "chat/completions"}`;
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
      label: "Base URL",
      value:
        guide.id === "typingmind"
          ? endpoint
          : guide.id === "sillytavern" && a
            ? `${base}/v1`
            : base,
    },
    { label: "API key", value: key },
    { label: "Model ID", value: id },
  ];
  const vars: Record<string, string> = a
    ? { ANTHROPIC_BASE_URL: base, ANTHROPIC_API_KEY: key }
    : { OPENAI_API_BASE: base, OPENAI_API_KEY: key };
  switch (guide.id) {
    case "claude-code": {
      const values = {
        ANTHROPIC_BASE_URL: base,
        ANTHROPIC_AUTH_TOKEN: key,
        ANTHROPIC_MODEL: id,
        ANTHROPIC_DEFAULT_SONNET_MODEL: id,
        ANTHROPIC_DEFAULT_OPUS_MODEL: id,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: id,
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(model.maxOutputTokens ?? 4096),
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
        `name: Somiti\nversion: 1.0.0\nschema: v1\nmodels:\n  - name: Somiti\n    provider: ${protocol}\n    model: ${q(id)}\n    apiBase: ${q(base)}\n    apiKey: ${q(key)}\n    roles: [chat, edit, apply]`,
      );
      break;
    case "aider":
      add("Terminal", `${env(vars)}\naider --model ${protocol}/${id}`);
      break;
    case "goose":
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
      add("opencode.json (v1)", {
        provider: {
          somiti: {
            npm: a ? "@ai-sdk/anthropic" : "@ai-sdk/openai-compatible",
            name: "Somiti",
            options: { baseURL: base, apiKey: key },
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
                default_max_tokens: model.maxOutputTokens ?? 4096,
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
        models: {
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
                  maxTokens: model.maxOutputTokens ?? 4096,
                },
              ],
            },
          },
        },
      });
      break;
    case "openhands":
      fields[3] = { label: "Custom Model", value: `${protocol}/${id}` };
      add(
        "Environment",
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
        `endpoints:\n  custom:\n    - name: Somiti\n      baseURL: ${q(base)}\n      apiKey: ${q(key)}\n      models:\n        default: [${q(id)}]\n        fetch: true\n      titleConvo: false`,
      );
      break;
    case "raycast":
      add(
        "providers.yaml",
        `providers:\n  - id: somiti\n    name: Somiti\n    base_url: ${q(base)}\n    api_keys:\n      openai: ${q(key)}\n    models:\n      - id: ${q(id)}\n        name: ${q(model.name)}`,
      );
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
  return { fields, snippets, endpoint, protocol };
}
