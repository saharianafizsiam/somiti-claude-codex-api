import { describe, expect, it } from "vitest";
import { sentConfirmation, watchConfirmation } from "../ops/canva/confirmation.mjs";

// Minimal DOM fixture exercises the MutationObserver callback, including nodes
// removed before the next worker poll. No Canva session or invitation is used.
function fixture(initial = []) {
  let notify;
  let disconnected = false;
  const root = node("", { children: initial });
  class Observer {
    constructor(callback) { notify = callback; }
    observe() {}
    disconnect() { disconnected = true; }
  }
  const state = watchConfirmation(sentConfirmation.source, root, Observer);
  return {
    state,
    get disconnected() { return disconnected; },
    add(element) { notify([{ type: "childList", target: root, addedNodes: [element] }]); },
    change(element) { notify([{ type: "characterData", target: { nodeType: 3, parentElement: element } }]); },
  };
}
function node(value, { visible = true, live = false, children = [], tag = "DIV" } = {}) {
  return {
    nodeType: 1, tagName: tag, textContent: value,
    querySelectorAll: () => children,
    closest: () => live ? {} : null,
    checkVisibility: () => visible,
  };
}

describe("Canva fresh confirmation watcher", () => {
  it("ignores a hidden first match and captures a new numbered toast", () => {
    const f = fixture([node("Invitation sent", { visible: false })]);
    f.add(node("2 invitations sent"));
    expect(f.state.confirmed).toBe(true);
  });
  it("retains a brief accessible announcement after it disappears", () => {
    const f = fixture();
    const toast = node("Invite sent to student@example.com", { live: true, visible: false });
    f.add(toast);
    toast.textContent = "";
    f.change(toast);
    expect(f.state.confirmed).toBe(true);
    f.state.stop();
    expect(f.disconnected).toBe(true);
  });
  it("detects a live region whose text is updated rather than inserted", () => {
    const toast = node("", { live: true });
    const f = fixture([toast]);
    toast.textContent = "Invitations have been sent";
    f.change(toast);
    expect(f.state.confirmed).toBe(true);
  });
  it("does not reuse a pre-existing success notice", () => {
    const old = node("Invitations sent");
    const f = fixture([old]);
    f.change(old);
    expect(f.state.confirmed).toBe(false);
  });
  it("rejects failures, hidden templates, buttons, and closing the form", () => {
    const f = fixture();
    for (const value of ["Invitations not sent", "Failed: invitations sent to no one", "Send invitations", "Templates"])
      f.add(node(value));
    f.add(node("Invitation sent", { visible: false }));
    f.add(node("Invitation sent", { tag: "BUTTON" }));
    expect(f.state.confirmed).toBe(false);
  });
});
