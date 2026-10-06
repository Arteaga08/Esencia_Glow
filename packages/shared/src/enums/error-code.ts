/**
 * Códigos estables de error de la API. El front decide por código, nunca por el
 * texto del mensaje (que es lenguaje humano y puede cambiar). Solo existen para
 * los casos en que una pantalla debe distinguir un error de otro con el mismo
 * status; un error sin código se trata según su status.
 */
enum ErrorCode {
  /** 401 al cambiar la contraseña: la actual está mal (no es una sesión vencida). */
  CURRENT_PASSWORD_INCORRECT = "CURRENT_PASSWORD_INCORRECT",
  /** 403 al ingresar con credenciales válidas pero sin haber verificado el correo. */
  EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
  /** 403 de `verifyOrigin`: la petición viene de un origen que no está en la lista. */
  ORIGIN_NOT_ALLOWED = "ORIGIN_NOT_ALLOWED",
}

export { ErrorCode };
