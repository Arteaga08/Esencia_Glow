"use client";

import { useState } from "react";
import { CheckEmail } from "./check-email";
import { RegisterForm } from "./register-form";

/**
 * `/crear-cuenta`: el formulario y, al terminar, "revisa tu correo" en el mismo
 * lugar. El registro NO inicia sesión; esa pantalla es el único camino a la cuenta.
 */
function RegisterFlow({ loginHref }: { loginHref: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) return <CheckEmail email={sentTo} onChangeEmail={() => setSentTo(null)} />;
  return <RegisterForm loginHref={loginHref} onRegistered={setSentTo} />;
}

export { RegisterFlow };
