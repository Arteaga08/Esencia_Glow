/**
 * Rol base de autenticación/autorización. Las capacidades de negocio no
 * excluyentes (suscriptor, afiliado, etc.) NO se modelan aquí — cada una es su
 * propio documento ligado por userId y se deriva en tiempo de lectura.
 */
enum UserRole {
  CUSTOMER = "customer",
  ADMIN = "admin",
}

export { UserRole };
