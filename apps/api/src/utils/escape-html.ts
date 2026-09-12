/**
 * Escapa los cinco caracteres que importan dentro de HTML (§8 del plan de
 * 1.6.3). Todo texto interpolado en un correo transaccional pasa por aquí
 * — incluida `shippingAddress.fullName`, que escribe la clienta: sin esto,
 * un nombre con `<script>` sería un XSS almacenado apuntando a la propia
 * bandeja de la clienta que lo escribió.
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]!);
}

export { escapeHtml };
