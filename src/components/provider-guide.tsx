export function ProviderGuide({ provider }: { provider: string }) {
  return (
    <section className="panel full">
      <h2>
        {provider === "claude-n-codex"
          ? "claude-n-codex.com setup"
          : "MWAPI setup"}
      </h2>
      {provider === "claude-n-codex" ? (
        <>
          <p>
            Upstream origin: <code>https://claude-n-codex.com:8443</code>
          </p>
          <p>
            Chat: <code>/v1/chat/completions</code> · Claude:{" "}
            <code>/v1/messages</code>
          </p>
          <ol>
            <li>
              Set the provider origin and paths in the server environment.
            </li>
            <li>
              Set <code>CLAUDE_N_CODEX_OPENAI_API_KEY</code> for ChatGPT and{" "}
              <code>CLAUDE_N_CODEX_CLAUDE_API_KEY</code> for Claude.
            </li>
            <li>
              Select the model family to choose its credential. Family selects
              the account even when using a different supported endpoint.
            </li>
            <li>
              Add the exact upstream model ID, confirm pricing and capabilities,
              then enable the model.
            </li>
          </ol>
          <p className="muted">
            Each customer key needs its own assigned account credential and
            available quota. Check the customer balance before testing
            requests.
          </p>
        </>
      ) : (
        <>
          <p>
            Upstream origin: <code>https://api.mwapi.dev</code>
          </p>
          <ol>
            <li>
              Set <code>MWAPI_BASE_URL</code> and <code>MWAPI_API_KEY</code> on
              the server.
            </li>
            <li>
              Configure verified chat/messages paths with{" "}
              <code>MWAPI_CHAT_PATH</code> and <code>MWAPI_MESSAGES_PATH</code>.
            </li>
            <li>
              Load the upstream catalog below or add a verified model manually.
              Confirm its pricing and capabilities before enabling it.
            </li>
          </ol>
          <p className="muted">
            Messages: <code>/v1/messages</code>. Codex:{" "}
            <code>/v1/responses</code>. Check credit with{" "}
            <code>GET /v1/usage</code>. A quota-exhausted key needs a top-up or
            replacement; changing model names will not restore credit.
          </p>
        </>
      )}
      <p>
        Customer base URL: your Somiti API origin followed by{" "}
        <code>{provider === "claude-n-codex" ? "/v2" : "/v1"}</code>. Use Somiti
        credentials with this URL. Upstream secrets are never shown to
        customers.
      </p>
    </section>
  );
}

