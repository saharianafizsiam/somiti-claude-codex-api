"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { callAction, CopyValue } from "./actions";
import { ProviderGuide } from "./provider-guide";
type Choice = { id: string; displayName: string; family: string };
type Initial = Record<string, string | number | boolean | string[] | null>;
export function Field({
  label,
  name,
  value,
  type = "text",
  required = true,
}: {
  label: string;
  name: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}
export function KeyForm({
  models,
  initial = {},
  id,
}: {
  models: Choice[];
  initial?: Initial;
  id?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(
    String(initial.modelAccessMode || "CLAUDE_AND_OPENAI"),
  );
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{
    apiKey?: string;
    dashboardUrl?: string;
  }>({});
  const [pending, start] = useTransition();
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          try {
            const expires = String(f.get("expiresAt") || "");
            const r = await callAction(id ? "key.update" : "key.create", {
              id,
              name: f.get("name"),
              ...(!id && f.get("amount") ? { amount: f.get("amount") } : {}),
              modelAccessMode: mode,
              rateLimitPerMinute: f.get("rateLimitPerMinute"),
              allowedIps: String(f.get("allowedIps") || "")
                .split(/[\s,]+/)
                .filter(Boolean),
              modelIds: f.getAll("modelIds"),
              expiresAt: expires ? new Date(expires + "Z").toISOString() : null,
              createDashboard: f.get("createDashboard") === "on",
            });
            setResult(r);
            setMessage(
              id
                ? "API key updated."
                : "API key created. Save the credential securely.",
            );
            router.refresh();
          } catch (e) {
            setMessage((e as Error).message);
          }
        });
      }}
    >
      <Field
        label="API key name"
        name="name"
        value={String(initial.name || "")}
      />
      {!id && (
        <Field label="Initial credit (USD)" name="amount" required={false} />
      )}
      <label>
        Model access
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="CLAUDE_ONLY">Claude only</option>
          <option value="OPENAI_ONLY">ChatGPT / OpenAI only</option>
          <option value="CLAUDE_AND_OPENAI">Claude + ChatGPT</option>
          <option value="CUSTOM">Custom models</option>
        </select>
      </label>
      <Field
        label="Requests per minute"
        name="rateLimitPerMinute"
        type="number"
        value={Number(initial.rateLimitPerMinute || 60)}
      />
      <Field
        label="Expiration (UTC, optional)"
        name="expiresAt"
        type="datetime-local"
        required={false}
        value={String(initial.expiresAt || "")}
      />
      <Field
        label="Allowed IPs (comma separated, optional)"
        name="allowedIps"
        required={false}
        value={
          Array.isArray(initial.allowedIps) ? initial.allowedIps.join(", ") : ""
        }
      />
      {mode === "CUSTOM" && (
        <fieldset className="full">
          <legend>Select individual models</legend>
          {models.length ? (
            models.map((m) => (
              <label className="checkbox" key={m.id}>
                <input
                  type="checkbox"
                  name="modelIds"
                  value={m.id}
                  defaultChecked={
                    Array.isArray(initial.modelIds) &&
                    initial.modelIds.includes(m.id)
                  }
                />
                {m.displayName} <span className="muted">{m.family}</span>
              </label>
            ))
          ) : (
            <p>Add models before selecting custom access.</p>
          )}
        </fieldset>
      )}
      {!id && (
        <label className="checkbox full">
          <input type="checkbox" name="createDashboard" defaultChecked />
          Create private customer dashboard
        </label>
      )}
      <div className="full">
        <Button disabled={pending}>
          {pending ? "Saving…" : id ? "Save key settings" : "Create API key"}
        </Button>
        {message && (
          <p role="status" className="form-message">
            {message}
          </p>
        )}
        {result.apiKey && <CopyValue value={result.apiKey} />}{" "}
        {result.dashboardUrl && <CopyValue value={result.dashboardUrl} />}
      </div>
    </form>
  );
}
const flags: [string, string][] = [
  ["enabled", "Enabled"],
  ["visible", "Visible"],
  ["autoFamilyAccess", "Automatic family access"],
  ["supportsOpenaiEndpoint", "OpenAI endpoint"],
  ["supportsAnthropicEndpoint", "Anthropic endpoint"],
  ["supportsStreaming", "Streaming"],
  ["supportsTools", "Tools"],
  ["supportsVision", "Vision"],
  ["supportsReasoning", "Reasoning"],
  ["supportsImages", "Images"],
  ["supportsStructuredOutput", "Structured output"],
];
export function ModelForm({
  initial = {},
  duplicate = false,
}: {
  initial?: Initial;
  duplicate?: boolean;
}) {
  const [selectedProvider, setSelectedProvider] = useState(
    String(initial.provider || "mwapi"),
  );
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const data: Record<string, unknown> = Object.fromEntries(f);
        flags.forEach(([key]) => {
          data[key] = f.get(key) === "on";
        });
        data.aliases = String(f.get("aliases") || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (initial.id && !duplicate) data.id = initial.id;
        start(async () => {
          try {
            const r = await callAction("model.save", data);
            router.push(`/dashboard/models/${r.id}`);
            router.refresh();
            setMessage("Model saved.");
          } catch (e) {
            setMessage((e as Error).message);
          }
        });
      }}
    >
      <Field
        label="Display name"
        name="displayName"
        value={String(initial.displayName || "")}
      />
      <Field
        label="Public model ID"
        name="publicModelId"
        value={duplicate ? "" : String(initial.publicModelId || "")}
      />
      <Field
        label="Upstream model ID"
        name="upstreamModelId"
        value={String(initial.upstreamModelId || "")}
      />
      <label>
        Family
        <select name="family" defaultValue={String(initial.family || "CLAUDE")}>
          {["CLAUDE", "OPENAI", "GEMINI", "GROK", "DEEPSEEK", "CUSTOM"].map(
            (s) => (
              <option key={s}>{s}</option>
            ),
          )}
        </select>
      </label>
      <label>
        Upstream provider
        <select
          name="provider"
          aria-label="Upstream provider"
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
        >
          <option value="mwapi">MWAPI</option>
          <option value="claude-n-codex">claude-n-codex.com</option>
        </select>
      </label>
      <ProviderGuide provider={selectedProvider} />
      <Field
        label="Description"
        name="description"
        required={false}
        value={String(initial.description || "")}
      />
      <Field
        label="Aliases (comma separated)"
        name="aliases"
        required={false}
        value={duplicate ? "" : String(initial.aliases || "")}
      />
      <Field
        label="Context window (reservation bound)"
        name="contextWindow"
        type="number"
        value={Number(initial.contextWindow || 32768)}
      />
      <Field
        label="Maximum output tokens"
        name="maxOutputTokens"
        type="number"
        value={Number(initial.maxOutputTokens || 4096)}
      />
      <fieldset className="full checks">
        <legend>Capabilities & availability</legend>
        {flags.map(([key, label]) => (
          <label className="checkbox" key={key}>
            <input
              type="checkbox"
              name={key}
              defaultChecked={
                typeof initial[key] === "boolean"
                  ? Boolean(initial[key])
                  : [
                      "enabled",
                      "visible",
                      "autoFamilyAccess",
                      "supportsStreaming",
                      "supportsOpenaiEndpoint",
                    ].includes(key)
              }
            />
            {label}
          </label>
        ))}
      </fieldset>
      <label>
        Pricing mode
        <select
          name="pricingMode"
          defaultValue={String(initial.pricingMode || "UPSTREAM_PLUS_MARKUP")}
        >
          <option value="UPSTREAM_PLUS_MARKUP">Upstream + markup</option>
          <option value="MANUAL_CUSTOMER_PRICE">Manual customer price</option>
        </select>
      </label>
      <Field
        label="Markup (%)"
        name="markupPercentage"
        value={String(initial.markupPercentage || "20")}
      />
      {[
        "upstreamInputPricePerMillion",
        "upstreamOutputPricePerMillion",
        "upstreamCachedInputPricePerMillion",
        "customerInputPricePerMillion",
        "customerOutputPricePerMillion",
      ].map((name, i) => (
        <Field
          key={name}
          label={
            [
              "Upstream input / 1M ($)",
              "Upstream output / 1M ($)",
              "Upstream cached input / 1M ($)",
              "Manual customer input / 1M ($)",
              "Manual customer output / 1M ($)",
            ][i]
          }
          name={name}
          value={String(initial[name] || "0")}
        />
      ))}
      <Field
        label="Sort order"
        name="sortOrder"
        type="number"
        value={Number(initial.sortOrder || 0)}
      />
      <div className="full">
        <p className="muted">
          Requests use only the selected provider. Enable only capabilities
          verified for that provider and model.
        </p>
        <Button disabled={pending}>{pending ? "Saving…" : "Save model"}</Button>
        {message && (
          <p role="status" className="form-message">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
export function RedeemForm({ generate = false }: { generate?: boolean }) {
  const [message, setMessage] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="panel form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => {
          try {
            const expires = String(f.get("expiresAt") || "");
            const r = await callAction(
              generate ? "redeem.create" : "redeem.use",
              generate
                ? {
                    amount: f.get("amount"),
                    quantity: f.get("quantity"),
                    expiresAt: expires
                      ? new Date(expires + "Z").toISOString()
                      : null,
                  }
                : { code: f.get("code") },
            );
            setCodes(r.codes || []);
            setMessage(
              generate
                ? "Save these codes. They are shown only once."
                : "Code redeemed. Wallet updated.",
            );
            router.refresh();
          } catch (e) {
            setMessage((e as Error).message);
          }
        });
      }}
    >
      {generate ? (
        <>
          <Field label="Value (USD)" name="amount" />
          <Field label="Quantity" name="quantity" type="number" value={1} />
          <Field
            label="Expiration (UTC, optional)"
            name="expiresAt"
            type="datetime-local"
            required={false}
          />
        </>
      ) : (
        <Field label="Redeem code" name="code" />
      )}
      <div className="full">
        <Button disabled={pending}>
          {pending ? "Saving…" : generate ? "Generate codes" : "Redeem balance"}
        </Button>
        {message && <p role="status">{message}</p>}
        {codes.map((c) => (
          <CopyValue key={c} value={c} />
        ))}
      </div>
    </form>
  );
}
export function SettingsForm({ initial }: { initial: Initial }) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="panel form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await callAction(
            "settings.save",
            Object.fromEntries(new FormData(e.currentTarget)),
          );
          setMessage("Settings saved.");
        } catch (e) {
          setMessage((e as Error).message);
        }
      }}
    >
      <Field
        label="Application name"
        name="applicationName"
        value={String(initial.applicationName)}
      />
      <Field
        label="Public API URL"
        name="publicApiUrl"
        value={String(initial.publicApiUrl)}
      />
      <Field
        label="Default rate limit"
        name="defaultRateLimit"
        type="number"
        value={Number(initial.defaultRateLimit)}
      />
      <div className="full">
        <Button>Save settings</Button>
        <p role="status">{message}</p>
      </div>
    </form>
  );
}
