/** Separa un nombre completo en el primer espacio: nombre y el resto como apellidos. */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const space = trimmed.search(/\s/);
  if (space === -1) return { firstName: trimmed, lastName: "" };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space).trim() };
}

/** Une nombre y apellidos como los une el API (`fullName`). */
function joinName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export { splitFullName, joinName };
