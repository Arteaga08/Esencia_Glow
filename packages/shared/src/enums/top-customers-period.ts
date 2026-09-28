/**
 * Periodo del ranking de mejores clientes (Milestone 2.6.1). Calendario en
 * curso en la zona horaria del negocio: semana desde el lunes, mes desde el
 * día 1, año desde el 1 de enero — nunca una ventana móvil de N días.
 */
enum TopCustomersPeriod {
  WEEK = "week",
  MONTH = "month",
  YEAR = "year",
}

export { TopCustomersPeriod };
