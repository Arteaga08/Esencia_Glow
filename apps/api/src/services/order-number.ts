import { randomInt } from "node:crypto";

/**
 * Folio legible de una orden (`EG-XXXXXXXX`). Generado con aleatoriedad
 * criptográfica, NUNCA con un contador compartido: un contador es un hot
 * spot de escritura bajo concurrencia y filtra el volumen total de ventas
 * del negocio con solo ver dos folios consecutivos.
 *
 * Alfabeto sin `I`, `O`, `0`, `1` — el folio se dicta por teléfono a
 * soporte, y esos caracteres se confunden entre sí al oído.
 */
const ORDER_NUMBER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const ORDER_NUMBER_BODY_LENGTH = 8;
const ORDER_NUMBER_PATTERN = /^EG-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;

function generateOrderNumber(): string {
  let body = "";
  for (let i = 0; i < ORDER_NUMBER_BODY_LENGTH; i++) {
    body += ORDER_NUMBER_ALPHABET[randomInt(ORDER_NUMBER_ALPHABET.length)];
  }
  return `EG-${body}`;
}

export { generateOrderNumber, ORDER_NUMBER_PATTERN };
