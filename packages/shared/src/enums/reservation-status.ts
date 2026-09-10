/**
 * Estados de una reserva de stock (StockReservation). `ACTIVE` es el único
 * estado que apartó unidades reales de `reserved`; `COMMITTED`/`RELEASED`
 * son terminales — una vez ahí, la transición contraria es un incidente, no
 * un no-op (ver stock-reservation.service.ts).
 */
enum ReservationStatus {
  ACTIVE = "active",
  COMMITTED = "committed",
  RELEASED = "released",
}

export { ReservationStatus };
