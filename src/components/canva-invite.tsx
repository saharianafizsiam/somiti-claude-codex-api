"use client";
import { useEffect, useState } from "react";
type Receipt = { id: string; token: string };
type Status = {
  status: string;
  position: number | null;
  paused: boolean;
  delayed: boolean;
};
async function request(action: string, body: unknown) {
  const response = await fetch(`/api/canva/invite/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      data.error?.message ??
        "Unable to check your invitation. Please try again.",
    );
  return data;
}
export function CanvaInvite({ enabled = false }: { enabled?: boolean }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!receipt) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next: Status = await request("status", receipt);
        if (stopped) return;
        setStatus(next);
        setError("");
        if (next.status === "SENT" || next.status === "REVIEW") return;
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error
              ? e.message
              : "Connection interrupted. Retrying…",
          );
      }
      if (!stopped) timer = setTimeout(poll, 5000);
    }
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [receipt]);
  return (
    <section className="canva-form" aria-labelledby="invite-title">
      <h2 id="invite-title">Get your invitation</h2>
      <p>One code. One email address. Invitations are sent one at a time.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            setReceipt(
              await request("enqueue", {
                code: data.get("code"),
                email: data.get("email"),
              }),
            );
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label htmlFor="canva-code">Invitation code</label>
        <input
          id="canva-code"
          name="code"
          inputMode="text"
          pattern="(?:[0-9]{16}|CANVA-INVITE-(?:[A-Z0-9]{6}-){4}[A-Z0-9]{6})"
          maxLength={47}
          autoComplete="off"
          placeholder="CANVA-INVITE-HDJ8SD-LS4H2L-4A2B9C-Q7M8NP-X3K5ZR"
          style={{ textTransform: "uppercase" }}
          required
          disabled={!!receipt}
        />
        <label htmlFor="canva-email">Canva email address</label>
        <input
          id="canva-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={!!receipt}
        />
        <button
          className="button button-primary"
          disabled={!enabled || busy || !!receipt}
        >
          {busy ? "Joining queue…" : "Get invite"}
        </button>
        {!enabled && !receipt && (
          <p className="canva-notice">
            Invitations are not open yet. Your code has not been used.
          </p>
        )}
        {receipt && (
          <div className="canva-notice" role="status" aria-live="polite">
            {!status ? (
              "Checking your queue position…"
            ) : status.status === "QUEUED" ? (
              <>
                <strong>Queue position #{status.position}</strong>
                <p>
                  {status.paused
                    ? "The queue is paused. Your place is saved."
                    : "We’ll send your invitation when it’s your turn."}
                </p>
              </>
            ) : status.status === "PROCESSING" ? (
              status.delayed ? (
                "Delivery is taking longer than expected. Your place is reserved; please contact support."
              ) : (
                "Sending your invitation…"
              )
            ) : status.status === "SENT" ? (
              "Invitation sent. Check your email to accept it."
            ) : (
              "Your invitation needs a team review. Your code is reserved; please contact support."
            )}
            {status && (
              <ol
                className="canva-queue-steps"
                aria-label="Invitation progress"
              >
                <li
                  aria-current={status.status === "QUEUED" ? "step" : undefined}
                >
                  Queued
                </li>
                <li
                  aria-current={
                    status.status === "PROCESSING" ? "step" : undefined
                  }
                >
                  Sending
                </li>
                <li
                  aria-current={status.status === "SENT" ? "step" : undefined}
                >
                  Invitation sent
                </li>
              </ol>
            )}
            <small>
              You can return by submitting the same code and email. This won’t
              send a duplicate.
            </small>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
