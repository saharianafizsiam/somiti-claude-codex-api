"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Copy, Check, Eye } from "lucide-react";
export async function callAction(action: string, data: unknown) {
  const res = await fetch(`/api/admin/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error?.message || "Request failed");
  window.dispatchEvent(
    new CustomEvent("somiti:notice", {
      detail:
        action === "key.reveal" ? "Credential revealed." : "Changes saved.",
    }),
  );
  return value;
}
export function CopyValue({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-value">
      <code>{value}</code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={label || "Copy"}
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </Button>
    </div>
  );
}
export function ActionButton({
  action,
  data,
  children,
  danger = false,
}: {
  action: string;
  data: Record<string, unknown>;
  children: React.ReactNode;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button
        variant={danger ? "destructive" : "secondary"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Confirm action</DialogTitle>
          <DialogDescription>
            {action === "key.rotate"
              ? "Replace this API key? Applications using the old key will stop working. Update each client with the new key afterward."
              : action === "key.archive"
                ? "Delete this customer key? API access and its private dashboard will stop working. Existing request records are retained."
                : action === "key.unshare"
                  ? "Disable this private dashboard link? The customer will no longer be able to open it."
                  : action === "key.share"
                    ? "Create a new private dashboard link? Any previous link will stop working. Share the new link only with this customer."
                    : action === "model.archive"
                      ? "Archive this model? Customers will no longer be able to send requests to it. Existing request records are retained."
                      : "Apply this change to the selected item?"}
          </DialogDescription>
          {message && (
            <pre className="result" role="status">
              {message}
            </pre>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const r = await callAction(action, data);
                  setMessage(
                    r.apiKey || r.dashboardUrl || "Saved successfully.",
                  );
                  router.refresh();
                } catch (e) {
                  setMessage((e as Error).message);
                }
              })
            }
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function MoneyForm({
  action,
  id,
  returning,
  label,
}: {
  action: string;
  id?: string;
  returning?: boolean;
  label: string;
}) {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            await callAction(action, { id, returning, amount: value });
            setMessage("Balance updated.");
            setValue("");
            router.refresh();
          } catch (e) {
            setMessage((e as Error).message);
          }
        });
      }}
    >
      <label>
        {label}
        <input
          required
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <Button disabled={pending}>{pending ? "Saving…" : label}</Button>
      {message && (
        <p className="form-message" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
export function SecretReveal({
  keyId,
  shareToken,
  prefix,
}: {
  keyId?: string;
  shareToken?: string;
  prefix: string;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  return (
    <div>
      {value ? (
        <CopyValue value={value} />
      ) : (
        <div className="copy-value">
          <code>{prefix}••••••••••••</code>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={async () => {
              try {
                const r = keyId
                  ? await callAction("key.reveal", { id: keyId })
                  : await fetch(`/api/share/${shareToken}/reveal`, {
                      cache: "no-store",
                    }).then((r) => {
                      if (!r.ok)
                        throw new Error("Dashboard link is no longer valid.");
                      return r.json();
                    });
                setValue(r.apiKey);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Eye size={15} /> Reveal
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function Logout() {
  const router = useRouter();
  return (
    <button
      className="logout"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
