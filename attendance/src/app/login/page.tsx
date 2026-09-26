import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthShell } from "@/components/ui/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <AuthShell>
      <div>
        <h1>Bienvenido de nuevo</h1>
        <p className="text-2" style={{ margin: 0 }}>
          Ingresa a EduTrack con tu cuenta del colegio.
        </p>
      </div>
      {error === "link" && (
        <div className="callout danger">
          <p>Ese enlace de acceso no es válido o ya venció. Pide uno nuevo a la administración de tu colegio.</p>
        </div>
      )}
      <LoginForm />
      <p className="hint">Las cuentas las crea la administración de tu colegio.</p>
    </AuthShell>
  );
}
