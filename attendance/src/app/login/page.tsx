import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="narrow">
      <div className="card stack">
        <div>
          <h1>Sign in</h1>
          <p className="muted">School Attendance</p>
        </div>
        {error === "link" && (
          <p className="error">That sign-in link is invalid or has expired. Ask your school admin for a new one.</p>
        )}
        <LoginForm />
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Accounts are created by your school administrator.
        </p>
      </div>
    </main>
  );
}
