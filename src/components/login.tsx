"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function LoginForm() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              Object.fromEntries(new FormData(e.currentTarget)),
            ),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error.message);
          router.push("/dashboard");
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Username or email
        <input
          name="username"
          type="text"
          required
          autoComplete="username"
          placeholder="Your admin username"
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </label>
      <label>
        2FA code{" "}
        <span className="muted">
          Enter the six-digit code from your authenticator app
        </span>
        <input
          name="totp"
          required
          pattern="[0-9]{6}"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
        />
      </label>
      {error && (
        <p role="alert" className="form-message">
          {error}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "Signing in…" : "Sign in to your workspace"}
      </Button>
    </form>
  );
}
