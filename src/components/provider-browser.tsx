"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { callAction } from "./actions";
import { Button } from "./ui/button";
import Link from "next/link";
export function ProviderSelector({ provider }: { provider: string }) {
  const router = useRouter();
  return (
    <label style={{ maxWidth: 360, marginBottom: 24 }}>
      Upstream provider
      <select
        aria-label="Upstream provider"
        value={provider}
        onChange={(e) =>
          router.push(`/dashboard/models?provider=${e.target.value}`)
        }
      >
        <option value="mwapi">MWAPI</option>
        <option value="claude-n-codex">claude-n-codex.com</option>
      </select>
    </label>
  );
}
export function ProviderDiscovery({ provider }: { provider: string }) {
  const router = useRouter();
  const [family, setFamily] = useState("CLAUDE");
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel">
      <h2>Upstream model catalog</h2>
      <p className="muted">
        Import and enable models for this account for matching keys. Previously
        imported drafts are enabled too. Custom edits and archived models are
        preserved.
      </p>
      {provider === "claude-n-codex" && (
        <label>
          Account
          <select
            value={family}
            onChange={(e) => {
              setFamily(e.target.value);
              setRows([]);
              setMessage("");
            }}
          >
            <option value="CLAUDE">Claude</option>
            <option value="OPENAI">ChatGPT / OpenAI</option>
          </select>
        </label>
      )}
      <Button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setRows([]);
          try {
            const data = await callAction("provider.models", {
              provider,
              family,
            });
            setRows(data.models);
            setMessage(data.models.length ? "" : "No models returned.");
          } catch (e) {
            setMessage((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Loading…" : "Load upstream models"}
      </Button>
      <p role="status">{message}</p>
      <div className="tabs">
        {(["saved", "live"] as const).map((source) => (
          <Button
            key={source}
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const result = await callAction("provider.import", {
                  provider,
                  family,
                  source,
                });
                setMessage(
                  `${result.added} models added and enabled; ${result.activated} previous drafts enabled. Matching keys can now use them. For custom-access keys, select the models in the key settings.`,
                );
                router.refresh();
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {source === "saved"
              ? "Import & enable saved models"
              : "Refresh & enable from API"}
          </Button>
        ))}
      </div>
      {rows.map((m) => (
        <div className="model-row" key={m.id}>
          <div>
            {m.name}
            <div className="muted">{m.id}</div>
          </div>
          <Link
            className="button button-secondary"
            href={`/dashboard/models/new?${new URLSearchParams({ provider, family, upstream: m.id, name: m.name })}`}
          >
            Add model
          </Link>
        </div>
      ))}
    </section>
  );
}

