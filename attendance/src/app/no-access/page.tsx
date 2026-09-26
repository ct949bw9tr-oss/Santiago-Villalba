import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { AuthShell } from "@/components/ui/auth-shell";

export const metadata = { title: "Sin acceso" };

export default async function NoAccessPage({ searchParams }: PageProps<"/no-access">) {
  const { reason } = await searchParams;
  const user = await getCurrentUser();

  return (
    <AuthShell>
      <div className="empty-icon" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
        <ShieldAlert size={22} />
      </div>
      <div>
        <h1>Sin acceso</h1>
        <p className="text-2" style={{ margin: 0 }}>
          {reason === "suspended"
            ? "La cuenta de este colegio está suspendida. Comunícate con la administración de tu colegio."
            : "Tu cuenta todavía no está vinculada a ningún colegio. Pide a la administración de tu colegio que te invite."}
        </p>
      </div>
      {user && <SignOutButton />}
    </AuthShell>
  );
}
