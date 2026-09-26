"use client";

import { startTransition, useActionState } from "react";
import { setPassword } from "@/server/auth/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, undefined);

  return (
    <form
      className="stack"
      onSubmit={(event) => {
        // Submit manually so React doesn't clear the fields when saving fails.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <label>
        Nueva contraseña
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label>
        Confirmar contraseña
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {state?.error && (
        <div className="callout danger" role="alert">
          <p>{state.error}</p>
        </div>
      )}
      <p className="hint">Mínimo 10 caracteres.</p>
      <button type="submit" className="lg" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
