import { getCurrentUser } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function NoAccessPage({ searchParams }: PageProps<"/no-access">) {
  const { reason } = await searchParams;
  const user = await getCurrentUser();

  return (
    <main className="narrow">
      <div className="card stack">
        <h1>No access</h1>
        <p>
          {reason === "suspended"
            ? "This school's account is currently suspended. Please contact your school administrator."
            : "Your account isn't linked to any school yet. Ask your school administrator to invite you."}
        </p>
        {user && <SignOutButton />}
      </div>
    </main>
  );
}
