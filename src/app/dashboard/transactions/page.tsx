import { OwnerPage } from "@/server/owner-page";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <OwnerPage section="transactions" search={await searchParams} />;
}
