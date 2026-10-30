// Canva uses both "invite" and "invitation" in its success notices.
export const sentConfirmation =
  /^(?:(?:\d+|your)\s+)?(?:invites?|invitations?)\s+(?:(?:has|have)\s+been\s+)?(?:successfully\s+)?sent\b|^successfully\s+sent\s+(?:\d+\s+)?invit(?:e|ation)s?\b|^invited successfully\b/i;

// Self-contained so Playwright can install it in the page before the click.
// Keep a result even when a toast disappears before Playwright finishes clicking.
export function watchConfirmation(
  pattern,
  root = globalThis.document.body,
  Observer = globalThis.MutationObserver,
) {
  const expression = new RegExp(pattern, "i");
  const previous = new WeakMap();
  const state = { confirmed: false, stop: () => observer.disconnect() };
  const text = (node) => (node.textContent ?? "").replace(/\s+/g, " ").trim();
  const elements = (node) => {
    const element = node.nodeType === 1 ? node : node.parentElement;
    return element ? [element, ...element.querySelectorAll("*")] : [];
  };
  // Existing notices never confirm a new send, including hidden copies.
  for (const element of elements(root)) previous.set(element, text(element));
  const inspect = (node) => {
    for (const element of elements(node)) {
      if (/^(SCRIPT|STYLE|BUTTON|INPUT|TEXTAREA)$/.test(element.tagName)) continue;
      const value = text(element);
      const old = previous.get(element);
      previous.set(element, value);
      if (value === old || value.length > 500 || !expression.test(value)) continue;
      // Accessible live announcements count even if visually hidden. Other
      // hidden DOM (templates, stale toasts) must not confirm delivery.
      const announced = element.closest('[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]');
      if (announced || element.checkVisibility()) state.confirmed = true;
    }
  };
  const observer = new Observer((records) => {
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) inspect(node);
        inspect(record.target);
      } else inspect(record.target);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true });
  return state;
}
