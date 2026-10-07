# Client readiness

## Fix the Claude Code tools error after deployment

Open **Models**, choose the account (API v1 or API v2), and click **Import & enable saved models**. This repairs tool and reasoning flags on unchanged imported records. Explicitly edited, disabled, and archived models are preserved. For a manually edited Opus model, open Edit and enable Tools and Reasoning before saving.

Claude Code can use the exact public ID shown in Connect. An `anthropic/` prefix is not universally required. Somiti also resolves names such as `anthropic/opus5.5` within the key's allowed Claude catalog and assigned provider. It does not grant extra models or route access.

## Implemented protocols

Both API routes expose Responses, Messages, Chat Completions, Responses compaction, and Messages token counting. V2 also exposes Responses input-token counting; v1 returns 501 for that unsupported operation. Responses supports HTTP streaming, function-call events, final nested usage, and the assigned customer's upstream key. Codex examples use `wire_api = "responses"`, `supports_websockets = false`, and `SOMITI_API_KEY`.

Requests are stateless: use `store=false` and send conversation input. Background requests, previous_response_id, response retrieval, WebSockets, Files, embeddings, audio, and image-generation APIs are not provided.

Both dashboards list 38 client guides and filter models by protocol. A guide is not a claim that every application version or every subscription feature has been generation-tested. Claude Desktop gateway access depends on installation and organization policy. Browser clients can use public API CORS with an explicit API key; admin endpoints do not receive this permission.

## Evidence and limits

- Live v2 GPT-5.5 Responses streaming completed successfully.
- Live v2 Claude Opus 5.5 returned a tool-use response.
- V1 Messages token counting returned 200. Later v1 generation checks returned 429; successful v1 generation remains unverified.
- The v1 input-token path returned a Response object rather than a token-count object. Do not rely on it for token counting.
- Automated checks exercise streaming usage, tool events, model restrictions, catalog repair, unauthorized access, and client configuration.
- Production deployment and database have not been changed from this workspace. Deploy and refresh the catalog, then test each customer key through its private Connect page before release.

Configuration references: [Codex](https://learn.chatgpt.com/docs/config-file/config-reference), [OpenCode](https://opencode.ai/docs/providers/).
