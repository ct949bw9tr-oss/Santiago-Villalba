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
