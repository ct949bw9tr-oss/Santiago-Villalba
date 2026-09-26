import { redirect } from "next/navigation";
import { schoolHomePath } from "@/lib/auth/roles";
import { requireSchoolAccess } from "@/server/auth/session";

export default async function SchoolHome({ params }: PageProps<"/s/[schoolSlug]">) {
  const { schoolSlug } = await params;
  redirect(schoolHomePath(await requireSchoolAccess(schoolSlug)));
}
