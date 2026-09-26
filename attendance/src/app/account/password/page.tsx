import { requireUser } from "@/server/auth/session";
import { PasswordForm } from "./password-form";

export default async function SetPasswordPage() {
  const user = await requireUser();

  return (
    <main className="narrow">
      <div className="card stack">
        <div>
          <h1>Choose a password</h1>
          <p className="muted">Signed in as {user.email}</p>
        </div>
        <PasswordForm />
      </div>
    </main>
  );
}
