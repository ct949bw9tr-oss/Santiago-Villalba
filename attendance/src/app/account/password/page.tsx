import { requireUser } from "@/server/auth/session";
import { AuthShell } from "@/components/ui/auth-shell";
import { PasswordForm } from "./password-form";

export const metadata = { title: "Contraseña" };

export default async function SetPasswordPage() {
  const user = await requireUser();

  return (
    <AuthShell>
      <div>
        <h1>Elige tu contraseña</h1>
        <p className="text-2" style={{ margin: 0 }}>
          Sesión iniciada como <strong>{user.email}</strong>
        </p>
      </div>
      <PasswordForm />
    </AuthShell>
  );
}
