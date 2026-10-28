import Link from "next/link";
import { CanvaInvite } from "@/components/canva-invite";
import { canvaQueueEnabled } from "@/server/canva-queue";
export const dynamic = "force-dynamic";
export const metadata = { title: "Canva Education invitation" };
export default function Page() {
  return (
    <main className="canva-public">
      <header>
        <Link href="/">SOMITI</Link>
        <span>Canva Education</span>
      </header>
      <div className="canva-invite-layout">
        <section>
          <h1>
            Your next idea
            <br />
            starts here.
          </h1>
          <p>
            Redeem your invitation code to join your school’s Canva Education
            team.
          </p>
          <ol>
            <li>Enter your 16-digit invitation code.</li>
            <li>Use the email you sign in to Canva with.</li>
            <li>Accept the invitation in your inbox.</li>
          </ol>
          <p className="muted">
            For eligible members of the school team. Access is provided through
            Canva Education.
          </p>
        </section>
        <CanvaInvite enabled={canvaQueueEnabled()} />
      </div>
    </main>
  );
}
