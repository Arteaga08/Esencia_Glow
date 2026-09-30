const OBJECT_ID = /\b[a-f0-9]{24}\b/g;

/** El backend cita ids crudos al rechazar una edición ("El producto
 * 64ab… no está activo"); aquí se cambian por el nombre que el editor de
 * productos ya resolvió, para que el error se lea en lenguaje humano. */
function humanize(message: string, names: Map<string, string>): string {
  return message.replace(OBJECT_ID, (id) => names.get(id) ?? "(no disponible)");
}

export { humanize };
