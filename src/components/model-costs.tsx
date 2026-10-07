"use client";
import { useState } from "react";
import type { AccountInfo } from "@/lib/providers/account";
import { CopyValue } from "./actions";
type Model = { id: string; name: string };
const price = (v: string) =>
  `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(Number(v))}`;
const tokens = (v: number | null | undefined) =>
  v == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v);
export function ModelCosts({
  models,
  account,
}: {
  models: Model[];
  account: AccountInfo;
}) {
  const [tab, setTab] = useState("Models");
  const [search, setSearch] = useState("");
  const groups = Array.from(new Set(models.map((m) => m.name)))
    .map((name) => {
      const aliases = models.filter((m) => m.name === name);
      const model =
        aliases.find(
          (m) => m.id.startsWith("v2/claude-") && account.prices[m.id],
        ) ||
        aliases.find((m) => account.prices[m.id]) ||
        aliases[0];
      return { model, aliases };
    })
    .filter((g) =>
      g.aliases.some((m) =>
        `${m.name} ${m.id}`.toLowerCase().includes(search.toLowerCase()),
      ),
    );
  return (
    <section className="console-panel model-costs">
      <div className="console-section-head">
        <div>
          <h2>What a request costs</h2>
          <p>Live model rates and account token usage.</p>
        </div>
        {tab === "Models" && (
          <input
            aria-label="Search models"
            placeholder="Search models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </div>
      <div className="cost-tabs" role="group" aria-label="Cost view">
        {["Models", "Token types"].map((t) => (
          <button key={t} aria-pressed={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "Models" ? (
        <>
          <div className="cost-model-grid">
            {groups.map(({ model: m, aliases }) => {
              const rates = account.prices[m.id];
              return (
                <div className="cost-model" key={m.id}>
                  <div className="cost-model-title">
                    <strong>{m.name}</strong>
                    <span
                      className="cost-badge"
                      title="Input price per million tokens"
                    >
                      {rates ? `${price(rates.input)}/M` : "Price unavailable"}
                    </span>
                  </div>
                  <CopyValue value={m.id} />
                  <details>
                    <summary>
                      Rates{aliases.length > 1 ? " & alternate IDs" : ""}
                    </summary>
                    {rates ? (
                      <div className="cost-rate-grid">
                        {[
                          ["Input", rates.input],
                          ["Output", rates.output],
                          ["Cache read", rates.cacheRead],
                          ["Cache write", rates.cacheWrite],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <span>{label}</span>
                            <strong>{price(value)}/M</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>Prices could not be retrieved for this model.</p>
                    )}
                    {aliases
                      .filter((a) => a.id !== m.id)
                      .map((a) => (
                        <CopyValue key={a.id} value={a.id} />
                      ))}
                  </details>
                </div>
              );
            })}
          </div>
          {!groups.length && <p>No matching enabled models.</p>}
          <small className="cost-footnote">
            The badge is the input price per 1 million tokens. Expand Rates for
            output and cache prices. Actual charges are shown in request
            history.
          </small>
        </>
      ) : (
        <>
          <p>Account totals over the last 30 days · UTC</p>
          <div className="token-types">
            {[
              ["Cache read", account.stats?.tokens.cacheRead],
              ["Input", account.stats?.tokens.input],
              ["Cache write", account.stats?.tokens.cacheWrite],
              ["Output", account.stats?.tokens.output],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <span>{label}</span>
                <span
                  title={
                    typeof value === "number"
                      ? value.toLocaleString()
                      : undefined
                  }
                >
                  {tokens(value as number | null | undefined)}
                </span>
              </div>
            ))}
          </div>
          <div className="token-cache">
            <strong>
              {account.stats?.cacheHit == null
                ? "Unavailable"
                : `${account.stats.cacheHit.toFixed(1)}%`}
            </strong>
            <span> of context read from cache</span>
          </div>
          {account.stats?.cacheHit != null && (
            <progress
              aria-label="Cache hit rate"
              max={100}
              value={account.stats.cacheHit}
            />
          )}
          <small className="cost-footnote">
            Input is newly processed text; output is generated text. Cache
            writes store reusable context, and cache reads reuse it. Rates vary
            by model.
          </small>
        </>
      )}
    </section>
  );
}
