import { it, expect } from "vitest";
import { importedCapabilities } from "./imported-capabilities";
const model = {provider:"claude-n-codex",family:"CLAUDE",supportsTools:false,supportsReasoning:false,supportsOpenaiEndpoint:false,description:"Imported from API catalog. Uses the account family's standard endpoint; generation availability depends on the assigned key."};
it("repairs old untouched import defaults without requiring re-import",()=>{
 expect(importedCapabilities(model)).toMatchObject({supportsTools:true,supportsReasoning:true,supportsOpenaiEndpoint:true});
 expect(model.supportsTools).toBe(false);
});
it("preserves deliberate restrictions and unknown model records",()=>{
 for(const description of ["Configured by administrator.",null,"Custom model"]){const custom={...model,description};expect(importedCapabilities(custom)).toBe(custom);}
 expect(importedCapabilities({...model,provider:"other"}).supportsTools).toBe(false);
});
