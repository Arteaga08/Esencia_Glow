/**
 * Lista cerrada de paqueterías. Texto libre rompería la llamada real a
 * Skydropx en 1.9 — el stub de 1.5 solo usa un subconjunto de estos valores,
 * pero el enum ya cierra el vocabulario completo que el adapter real deberá
 * mapear.
 */
enum ShippingCarrier {
  ESTAFETA = "estafeta",
  FEDEX = "fedex",
  DHL = "dhl",
  PAQUETEEXPRESS = "paqueteexpress",
  REDPACK = "redpack",
}

export { ShippingCarrier };
