"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { useId, useState, type FormEvent } from "react";

type FormStatus = "idle" | "error" | "success";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Campo de correo del footer. Por ahora es solo visual: valida el formato y
 * muestra el éxito, pero no guarda nada.
 * TODO: conectar al boletín (modelo + POST público con rate limit) antes de
 * publicar la tienda.
 */
function NewsletterForm({ tone = "light" }: { tone?: "light" | "dark" }) {
  const inputId = useId();
  const messageId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");

  const dark = tone === "dark";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(EMAIL_PATTERN.test(email.trim()) ? "success" : "error");
  }

  const labelColor = dark ? "text-background/80" : "text-foreground/80";
  const borderColor = dark ? "border-background/60 focus-within:border-background" : "border-border-strong focus-within:border-foreground";
  const inputColor = dark ? "text-background placeholder:text-background/50" : "text-foreground placeholder:text-muted-foreground-strong";
  const messageColor =
    status === "error" ? (dark ? "text-primary" : "text-destructive-action") : dark ? "text-background" : "text-foreground";

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <label htmlFor={inputId} className={`type-shop-cta ${labelColor}`}>
        Correo electrónico
      </label>
      <div
        className={`mt-2 flex items-center border bg-[var(--surface-bg)] ${dark ? "bg-transparent" : ""} ${borderColor} rounded-md transition-colors duration-[var(--duration-base)] ease-out-quart motion-reduce:transition-none`}
      >
        <input
          id={inputId}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder="ana@correo.com"
          aria-invalid={status === "error"}
          aria-describedby={messageId}
          className={`min-h-12 min-w-0 flex-1 bg-transparent px-4 text-subtitle outline-none ${inputColor}`}
        />
        <button
          type="submit"
          aria-label="Suscribirme"
          className={`group flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${dark ? "text-background" : "text-foreground"}`}
        >
          <ArrowRight
            size={22}
            aria-hidden={true}
            className="transition-transform duration-[var(--duration-base)] ease-out-quart group-hover:translate-x-0.5 motion-reduce:transition-none"
          />
        </button>
      </div>
      <p id={messageId} role={status === "error" ? "alert" : "status"} className={`mt-2 min-h-5 text-body-sm ${messageColor}`}>
        {status === "error" && "Escribe un correo válido, como ana@correo.com"}
        {status === "success" && "Listo. Te escribiremos pronto."}
      </p>
    </form>
  );
}

export { NewsletterForm };
