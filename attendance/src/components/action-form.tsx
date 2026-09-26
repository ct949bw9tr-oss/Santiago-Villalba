"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/server/admin/common";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  /** Clear the fields after a successful submit (for "add" forms). */
  resetOnSuccess?: boolean;
  /** Ask before submitting (for destructive actions). */
  confirmText?: string;
  variant?: "primary" | "secondary";
  className?: string;
};

/**
 * Form bound to a Server Action with inline error/success feedback.
 * Submits manually so fields keep their values when the action returns an
 * error (React would otherwise reset the form on every submit).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Saving…",
  resetOnSuccess = false,
  confirmText,
  variant = "primary",
  className = "stack",
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state && !state.error) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmText && !window.confirm(confirmText)) return;
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      <div className="form-footer">
        <button type="submit" className={variant === "secondary" ? "secondary" : undefined} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state?.error && (
          <span className="error" role="alert">
            {state.error}
          </span>
        )}
        {state?.message && !state.error && <span className="success">{state.message}</span>}
      </div>
      {state?.secret && (
        <label>
          {state.secret.label}
          <input
            readOnly
            value={state.secret.value}
            onFocus={(e) => e.currentTarget.select()}
            style={{ fontFamily: "monospace" }}
          />
        </label>
      )}
      {state?.link && (
        <label>
          Share this one-time sign-in link with them (select it, then copy):
          <input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </form>
  );
}
