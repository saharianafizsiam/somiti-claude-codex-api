"use client";
import { useState } from "react";
import {
  clientGuides,
  compatibleModels,
  connectionGuide,
  type GuideModel,
} from "@/lib/client-guides";
import { CopyValue } from "./actions";
export function ClientConnectionGuides({
  baseUrl,
  models,
  shareToken,
}: {
  baseUrl: string;
  models: GuideModel[];
  shareToken: string;
}) {
  const isV1 = baseUrl.endsWith("/v1");
  const guides = clientGuides;
  const [clientId, setClientId] = useState("claude-code");
  const [search, setSearch] = useState("");
  const [modelId, setModelId] = useState("");
  const [os, setOs] = useState<"unix" | "windows">("unix");
  const [credential, setCredential] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guide = clientGuides.find((c) => c.id === clientId)!;
  const available = compatibleModels(guide, models);
  const model = available.find((m) => m.id === modelId) || available[0];
  const content = model
    ? connectionGuide(
        guide,
        model,
        baseUrl,
        credential || "YOUR_SOMITI_API_KEY",
        os,
      )
    : null;
  const matches = guides.filter((c) =>
    `${c.name} ${c.group}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <section className="console-panel console-url-guide">
        <h2>Choose the right connection URL</h2>
        <p>
          1. Choose your app. 2. Choose an allowed model. 3. Copy its settings
          and start a new session.
        </p>
        <p>
          These instructions use your assigned {isV1 ? "API v1" : "API v2"}{" "}
          route. Client features depend on the selected model and application
          version.
        </p>
        <div className="console-url-grid">
          <div>
            <h3>Anthropic / Claude provider</h3>
            <CopyValue value={baseUrl} />
            <small>The SDK adds /v1/messages automatically.</small>
          </div>
          <div>
            <h3>OpenAI-compatible provider</h3>
            <CopyValue value={baseUrl} />
            <small>
              Keep {isV1 ? "/v1" : "/v2"}. The client adds /chat/completions.
            </small>
          </div>
          <div>
            <h3>Full chat endpoint</h3>
            <CopyValue value={`${baseUrl}/chat/completions`} />
            <small>Only for fields asking for a complete endpoint.</small>
          </div>
        </div>
      </section>
      <div className="console-connect-grid console-client-guides">
        <aside className="console-panel">
          <div className="console-section-head">
            <h2>Clients</h2>
            <span>{guides.length}</span>
          </div>
          <input
            aria-label="Search clients"
            placeholder="Search clients…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <nav aria-label="Connection clients">
            {["Agents & IDEs", "Chat applications", "Automation & SDK"].map(
              (group) => (
                <div key={group}>
                  {matches.some((c) => c.group === group) && <h3>{group}</h3>}
                  {matches
                    .filter((c) => c.group === group)
                    .map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        aria-pressed={clientId === c.id}
                        onClick={() => {
                          setClientId(c.id);
                          setModelId("");
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                </div>
              ),
            )}
            {!matches.length && <p>No matching clients.</p>}
          </nav>
        </aside>
        <section
          className="console-panel console-guide-detail"
          aria-label="Client connection instructions"
        >
          <h2>{guide.name}</h2>
          <ol>
            {guide.steps.map((step) => (
              <li key={step}>{guide.id === "cursor" && step.startsWith("In Add Custom Model") && model?.id === "gpt-5.5" ? "Select Cursor’s built-in GPT-5.5 model: its ID is gpt-5.5. Do not add a second model with the same name." : step}</li>
            ))}
          </ol>
          {guide.note && <p className="console-guide-note">{guide.note}</p>}
          {guide.id !== "capabilities" && (
            <>
              {!model ? (
                <p role="status" className="console-guide-note">
                  No compatible model is enabled for this key. Ask your
                  administrator to refresh the API v2 catalog in Models, or
                  enable Chat Completions for a supported model.{" "}
                  {guide.protocol === "anthropic"
                    ? "This client needs a messages model."
                    : guide.protocol === "openai"
                      ? "This client needs a compatible OpenAI-protocol model."
                      : "Ask your administrator to enable a model."}
                </p>
              ) : (
                <>
                  {guide.id !== "claude-desktop" && <label>
                    Connection model
                    <select
                      aria-label="Connection model"
                      value={model.id}
                      onChange={(e) => setModelId(e.target.value)}
                    >
                      {available.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} · {m.id}
                        </option>
                      ))}
                    </select>
                  </label>}
                  {guide.group === "Agents & IDEs" && !model.tools && (
                    <p className="console-guide-note">
                      Agent tool use is disabled for this model. Your
                      administrator must enable supported tools before agent
                      tasks will work.
                    </p>
                  )}
                  <div className="console-guide-controls">
                    {guide.id !== "claude-desktop" && <div role="group" aria-label="Operating system">
                      <button
                        aria-pressed={os === "unix"}
                        onClick={() => setOs("unix")}
                      >
                        macOS / Linux
                      </button>
                      <button
                        aria-pressed={os === "windows"}
                        onClick={() => setOs("windows")}
                      >
                        PowerShell
                      </button>
                    </div>}
                    <button
                      disabled={busy}
                      onClick={async () => {
                        if (credential) {
                          setCredential("");
                          return;
                        }
                        setBusy(true);
                        setError("");
                        try {
                          const r = await fetch(
                            `/api/share/${shareToken}/reveal`,
                            { cache: "no-store" },
                          );
                          if (!r.ok)
                            throw new Error(
                              "Could not load your key. Check that this dashboard link is still active.",
                            );
                          setCredential((await r.json()).apiKey);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {busy
                        ? "Loading…"
                        : credential
                          ? "Hide key in examples"
                          : "Use my key in examples"}
                    </button>
                  </div>
                  {error && <p role="alert">{error}</p>}
                  <p>
                    {guide.id === "claude-desktop" ? "Copy these values into the gateway settings. " : "Merge configuration examples into your existing settings. "}
                    {credential
                      ? "Examples now contain your private Somiti key. Keep copied files private."
                      : "Replace YOUR_SOMITI_API_KEY with your key, or use the button above."}
                  </p>
                  <div className="console-guide-fields">
                    {content?.fields.map((f) => (
                      <div key={f.label}>
                        <label>{f.label}</label>
                        <CopyValue value={f.value} />
                      </div>
                    ))}
                  </div>
                  {content?.snippets.map((s) => (
                    <div className="console-guide-snippet" key={s.title}>
                      <h3>{s.title}</h3>
                      <CopyValue value={s.code} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
          {guide.id === "cursor" && (
            <aside className="console-guide-note">
              <h3>Connection checks</h3>
              <ul>
                <li>
                  No new request in History? Check that both the key and base
                  URL override are enabled, then select the custom model in a
                  new chat.
                </li>
                <li>
                  &ldquo;Out of usage&rdquo; or &ldquo;model already
                  available&rdquo;? You may have selected a built-in model. Use
                  the neutral custom model ID from the fields above.
                </li>
                <li>
                  Auto, Tab completion, and some Agent features may use
                  Cursor&apos;s services and limits. Requests and your key pass
                  through Cursor&apos;s servers.
                </li>
                <li>
                  The override affects other OpenAI models too. Disable it when
                  returning to models covered by your Cursor subscription.
                </li>
                <li>
                  No Save or Verify button? Test with a new chat. If chat works
                  but Agent does not, check model tool support and the
                  client&apos;s custom-provider limitations.
                </li>
              </ul>
            </aside>
          )}
        </section>
      </div>
    </>
  );
}
