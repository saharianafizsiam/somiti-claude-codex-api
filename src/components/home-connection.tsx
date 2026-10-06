"use client";
import { useState } from "react";
import { CopyValue } from "./actions";

export function HomeConnection() {
  const [route, setRoute] = useState("v1");

  return (
    <div className="connection-console">
      <div className="console-toolbar">
        <span>Connection guide</span>
        <span className="muted">cURL</span>
      </div>
      <div className="provider-switch" role="group" aria-label="API route">
        <button
          type="button"
          aria-pressed={route === "v1"}
          onClick={() => setRoute("v1")}
        >
          API v1
        </button>
        <button
          type="button"
          aria-pressed={route === "v2"}
          onClick={() => setRoute("v2")}
        >
          API v2
        </button>
      </div>
      <div aria-live="polite">
        <p className="console-label">List your available models</p>
        <CopyValue
          value={`curl https://YOUR_SOMITI_API_DOMAIN/${route}/models -H "Authorization: Bearer YOUR_SOMITI_API_KEY"`}
        />
      </div>
      <p className="console-note">
        Replace the domain and key with the values from your private dashboard.
        Never put your key in public browser code.
      </p>
    </div>
  );
}
