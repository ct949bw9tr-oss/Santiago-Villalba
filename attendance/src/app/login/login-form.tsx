"use client";

import { startTransition, useActionState } from "react";
import { signIn } from "@/server/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        // Submit manually so React doesn't clear the fields when sign-in fails.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <label>
        Correo electrónico
        <input name="email" type="email" autoComplete="email" required placeholder="nombre@colegio.edu.co" />
      </label>
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <div className="callout danger" role="alert">
          <p>{state.error}</p>
        </div>
      )}
      <button type="submit" className="lg" disabled={pending}>
        {pending ? "Ingresando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
