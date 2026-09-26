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
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <p className="error" role="alert" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
