import { describe, expect, it } from "vitest";
// @ts-expect-error Standalone worker module is deployed directly to Node.
import { sentConfirmation } from "../ops/canva/confirmation.mjs";

describe("Canva explicit send confirmation", () => {
  it("accepts invite and invitation success notices", () => {
    for (const text of [
      "Invites sent",
      "Invitation sent",
      "Invitations have been sent",
      "Invitations successfully sent",
      "Successfully sent 5 invitations",
      "Invited successfully",
    ])
      expect(sentConfirmation.test(text)).toBe(true);
  });
  it("does not treat a closed form, send button, or failure as success", () => {
    for (const text of [
      "Send invitations",
      "Invite students",
      "Invitations not sent",
      "Failed to send invitations",
      "Templates",
      "Invitation pending",
    ])
      expect(sentConfirmation.test(text)).toBe(false);
  });
});
