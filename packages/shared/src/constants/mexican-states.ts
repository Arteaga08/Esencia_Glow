/**
 * Las 32 entidades federativas de México, como lista cerrada. Texto libre en
 * la dirección de envío rompería la llamada real a Skydropx en 1.9 (el
 * adapter espera un catálogo de estados fijo, no lo que el cliente tecleó).
 */
const MEXICAN_STATES = [
  "Aguascalientes",
  "Baja California",
  "Baja California Sur",
  "Campeche",
  "Chiapas",
  "Chihuahua",
  "Ciudad de México",
  "Coahuila",
  "Colima",
  "Durango",
  "Estado de México",
  "Guanajuato",
  "Guerrero",
  "Hidalgo",
  "Jalisco",
  "Michoacán",
  "Morelos",
  "Nayarit",
  "Nuevo León",
  "Oaxaca",
  "Puebla",
  "Querétaro",
  "Quintana Roo",
  "San Luis Potosí",
  "Sinaloa",
  "Sonora",
  "Tabasco",
  "Tamaulipas",
  "Tlaxcala",
  "Veracruz",
  "Yucatán",
  "Zacatecas",
] as const;

type MexicanState = (typeof MEXICAN_STATES)[number];

export { MEXICAN_STATES };
export type { MexicanState };
