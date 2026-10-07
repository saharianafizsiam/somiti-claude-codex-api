import { expect, it } from "vitest";
import { customerCatalog, customerModelId } from "./customer-id";
it("exposes original v2 IDs without changing stored IDs or v1", () => {
 const m = { provider:"claude-n-codex", publicModelId:"v2/claude-opus-5-5", upstreamModelId:"claude-opus-5-5" };
 expect(customerModelId(m)).toBe("claude-opus-5-5");
 expect(customerCatalog([m])[0].publicModelId).toBe("claude-opus-5-5");
 expect(m.publicModelId).toBe("v2/claude-opus-5-5");
 expect(customerModelId({...m,provider:"mwapi",publicModelId:"v1/opus"})).toBe("v1/opus");
});
