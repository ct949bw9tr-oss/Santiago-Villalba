import { redirect } from "next/navigation";
import { postLoginPath } from "@/lib/auth/roles";
import { getMyMemberships, requireUser } from "@/server/auth/session";

export default async function Home() {
  await requireUser();
  redirect(postLoginPath(await getMyMemberships()));
}
