import { OwnerPage } from "@/server/owner-page";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <OwnerPage />;
}
