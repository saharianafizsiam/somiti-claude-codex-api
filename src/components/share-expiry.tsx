"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { callAction, CopyValue } from "./actions";
import { Button } from "./ui/button";
export function ShareExpiry({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const date = new FormData(e.currentTarget).get("expiresAt") as string;
        try {
          const r = await callAction("key.share", {
            id,
            expiresAt: new Date(date + "Z").toISOString(),
          });
          setUrl(r.dashboardUrl);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <label style={{ marginTop: 18 }}>
        Generate link with expiration (UTC)
        <input type="datetime-local" name="expiresAt" required />
      </label>
      <Button variant="secondary" size="sm">
        Replace link with expiry
      </Button>
      {url && <CopyValue value={url} />}
      <p role="status">{error}</p>
    </form>
  );
}
