"use client";

import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import type { FormState } from "@/server/admin/common";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: React.ReactNode;
  submitLabel: React.ReactNode;
  pendingLabel?: string;
  /** Clear the fields after a successful submit (for "add" forms). */
  resetOnSuccess?: boolean;
  /** Ask before submitting (for destructive actions). */
  confirmText?: string;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
  /** Show the result as a toast only (for compact inline buttons). */
  quiet?: boolean;
};

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <label>
      {label}
      <div className="row">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={`grow${mono ? " mono" : ""}`} />
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              toast("Copiado al portapapeles");
            } catch {
              toast("No se pudo copiar: selecciona el texto y cópialo", "error");
            }
          }}
        >
          <Copy size={15} /> {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </label>
  );
}

/**
 * Form bound to a Server Action with inline + toast feedback.
 * Submits manually so fields keep their values when the action returns an
 * error (React would otherwise reset the form on every submit).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Guardando…",
  resetOnSuccess = false,
  confirmText,
  confirmLabel = "Sí, continuar",
  variant = "primary",
  className = "stack",
  quiet = false,
}: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.error) toast(state.error, "error");
    else if (state.message) toast(state.message, "success");
    if (resetOnSuccess && !state.error) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function submit() {
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    startTransition(() => formAction(formData));
  }

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmText) setAsking(true);
        else submit();
      }}
    >
      {children}
      <div className="form-footer">
        <button type="submit" className={variant === "primary" ? undefined : variant} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {!quiet && state?.error && (
          <span className="form-feedback error" role="alert">
            <AlertCircle size={15} /> {state.error}
          </span>
        )}
        {!quiet && state?.message && !state.error && (
          <span className="form-feedback success">
            <CheckCircle2 size={15} /> {state.message}
          </span>
        )}
      </div>
      {state?.secret && <CopyField label={state.secret.label} value={state.secret.value} mono />}
      {state?.link && <CopyField label="Comparte este enlace de acceso de un solo uso:" value={state.link} />}
      {confirmText && (
        <ConfirmModal
          open={asking}
          message={confirmText}
          confirmLabel={confirmLabel}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            submit();
          }}
        />
      )}
    </form>
  );
}
