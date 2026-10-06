import { OwnerPage } from "@/server/owner-page";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <OwnerPage
      section="keys"
      id={(await params).id}
      search={await searchParams}
    />
  );
}
