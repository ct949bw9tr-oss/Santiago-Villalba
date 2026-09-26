"use client";

import { useActionState } from "react";
import { setPassword } from "@/server/auth/actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState(setPassword, undefined);

  return (
    <form action={action} className="stack">
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      <label>
        Confirm password
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {state?.error && (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
