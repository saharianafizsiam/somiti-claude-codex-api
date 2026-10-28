"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
type Data = {
  totals: { total: number; unused: number; sent: number; assigned: number };
  page: number;
  rows: {
    id: string;
    code: string;
    email: string | null;
    status: string;
    created: string;
  }[];
};
export function CanvaAdmin({ data }: { data: Data }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(10);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function action(name: string, body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/canva/admin/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(d.error?.message || "Could not complete the action.");
      if (d.codes) setCodes(d.codes);
      setMessage(
        name === "generate"
          ? `${d.codes.length} codes created.`
          : "Unused code deleted.",
      );
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Could not complete the action.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage(
        "Clipboard unavailable. Select the codes and copy them manually.",
      );
    }
  }
  return (
    <div className="canva-admin">
      <div className="canva-admin-heading">
        <div>
          <h1>Canva</h1>
          <p className="muted">
            Manage invitation codes and their assigned email addresses.
          </p>
        </div>
        <Link className="button button-secondary" href="/canva/invite">
          Open invite page
        </Link>
      </div>
      <div className="canva-notice">
        <strong>Canva connection needed</strong>
        <p>
          Codes can be prepared now. Invitation delivery and team removal stay
          disabled until a supported connection or tested browser worker is
          configured.
        </p>
      </div>
      <div className="canva-counts">
        {[
          ["Total codes", data.totals.total],
          ["Unused", data.totals.unused],
          ["Assigned emails", data.totals.assigned],
          ["Invitations sent", data.totals.sent],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{Number(value).toLocaleString()}</strong>
          </div>
        ))}
      </div>
      <section className="canva-panel">
        <h2>Generate codes</h2>
        <form
          className="canva-generate"
          onSubmit={(e) => {
            e.preventDefault();
            void action("generate", { quantity });
          }}
        >
          <label htmlFor="canva-quantity">Number of codes</label>
          <input
            id="canva-quantity"
            type="number"
            min={1}
            max={1000}
            value={quantity}
            required
            onChange={(e) => setQuantity(e.target.valueAsNumber)}
          />
          <button className="button button-primary" disabled={busy}>
            Generate codes
          </button>
          <span className="muted">Up to 1,000 per batch</span>
        </form>
        {codes.length > 0 && (
          <div className="canva-generated">
            <div>
              <h3>{codes.length} new codes</h3>
              <button
                className="button button-secondary"
                onClick={() => copy(codes.join("\n"))}
              >
                Copy all
              </button>
            </div>
            <textarea
              aria-label="Generated codes, one per line"
              readOnly
              value={codes.join("\n")}
              rows={Math.min(12, codes.length + 1)}
            />
          </div>
        )}
      </section>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <section className="canva-panel">
        <h2>Codes and invitations</h2>
        <div className="canva-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Email address</th>
                <th>Status</th>
                <th>Created (UTC)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code>{r.code}</code>
                  </td>
                  <td>{r.email || "Not assigned"}</td>
                  <td>{r.status.toLowerCase()}</td>
                  <td>{r.created.slice(0, 16).replace("T", " ")}</td>
                  <td>
                    <button
                      className="button button-ghost"
                      onClick={() => copy(r.code)}
                    >
                      Copy
                    </button>
                    {r.status === "UNUSED" && !r.email ? (
                      <button
                        className="button button-ghost"
                        disabled={busy}
                        onClick={() => action("delete", { id: r.id })}
                      >
                        Delete unused
                      </button>
                    ) : (
                      <button
                        className="button button-ghost"
                        disabled
                        title="Connect Canva to revoke team access before clearing this code"
                      >
                        Remove access
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!data.rows.length && (
                <tr>
                  <td colSpan={5}>
                    No codes yet. Generate your first batch above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="canva-pagination">
          {data.page > 1 && (
            <Link
              className="button button-secondary"
              href={`/dashboard/canva?page=${data.page - 1}`}
            >
              Previous
            </Link>
          )}
          <span>Page {data.page}</span>
          {data.page * 50 < data.totals.total && (
            <Link
              className="button button-secondary"
              href={`/dashboard/canva?page=${data.page + 1}`}
            >
              Next
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
