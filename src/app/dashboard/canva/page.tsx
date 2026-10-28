import { pageUser, requireAdmin } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { CanvaAdmin } from "@/components/canva-admin";
import { canvaOverview } from "@/server/canva";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await pageUser();
  requireAdmin(user);
  const page = Math.max(
    1,
    Math.min(100000, parseInt((await searchParams).page || "1") || 1),
  );
  return (
    <Shell section="canva" name={user.name} email={user.email}>
      <CanvaAdmin data={await canvaOverview(page)} />
    </Shell>
  );
}
