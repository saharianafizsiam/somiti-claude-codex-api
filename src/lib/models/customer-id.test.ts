import { expect, it } from "vitest";
import { customerCatalog, customerModelId, discoveryCatalog } from "./customer-id";
it("exposes original v2 IDs without changing stored IDs or v1", () => {
 const m = { provider:"claude-n-codex", publicModelId:"v2/claude-opus-5-5", upstreamModelId:"claude-opus-5-5" };
 expect(customerModelId(m)).toBe("claude-opus-5-5");
 expect(customerCatalog([m])[0].publicModelId).toBe("claude-opus-5-5");
 expect(m.publicModelId).toBe("v2/claude-opus-5-5");
 expect(customerModelId({...m,provider:"mwapi",publicModelId:"v1/opus"})).toBe("v1/opus");
});

it("lists one versioned model while retaining separate versions and alias-only access", () => {
 const row = (id: string) => ({provider:"claude-n-codex",publicModelId:"v2/"+id,upstreamModelId:id});
 const rows = ["opus", "opus-5.5", "claude-opus-5.5", "opus-5-5", "claude-opus-5-5", "claude-opus-5", "fable", "fable-5.1", "claude-fable-5.1"].map(row);
 expect(discoveryCatalog(rows).map(m=>m.upstreamModelId)).toEqual(["claude-opus-5-5","claude-opus-5","claude-fable-5.1"]);
 expect(rows).toHaveLength(9);
 expect(discoveryCatalog([row("opus-5.5")])).toEqual([row("opus-5.5")]);
 expect(discoveryCatalog([row("opus")])).toEqual([row("opus")]);
});
