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

it("enables image input only for verified v2 Claude imports",()=>{
 expect(importedCapabilities({...model,upstreamModelId:"claude-opus-5-5",supportsVision:false}).supportsVision).toBe(true);
 for (const upstreamModelId of ["claude-fable-5", "claude-fable-5.1", "claude-opus-4-6", "claude-opus-4-7", "claude-opus-4-8", "claude-opus-5", "claude-sonnet-4-6", "claude-sonnet-5"]) expect(importedCapabilities({...model,upstreamModelId,supportsVision:false}).supportsVision).toBe(true);
 expect(importedCapabilities({...model,upstreamModelId:"claude-unknown",supportsVision:false}).supportsVision).toBe(false);
 expect(importedCapabilities({...model,provider:"mwapi",upstreamModelId:"claude-sonnet-5",supportsVision:false}).supportsVision).toBe(false);
 expect(importedCapabilities({...model,upstreamModelId:"opus-5.5",supportsVision:false,description:"Configured by administrator."}).supportsVision).toBe(false);
});
