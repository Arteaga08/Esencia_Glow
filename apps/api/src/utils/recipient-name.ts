/**
 * Une nombre y apellidos en el nombre de quien recibe (`fullName`). Los correos,
 * Stripe, la búsqueda del panel y las guías lo leen como un solo texto: el API
 * lo calcula siempre, nunca lo acepta de quien captura nombre y apellidos.
 */
function joinRecipientName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export { joinRecipientName };
