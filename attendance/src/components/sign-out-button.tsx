import { LogOut } from "lucide-react";
import { signOut } from "@/server/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="secondary">
        <LogOut size={16} /> Cerrar sesión
      </button>
    </form>
  );
}
