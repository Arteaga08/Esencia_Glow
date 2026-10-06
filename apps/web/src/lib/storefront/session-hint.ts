/**
 * Pista de "esta pestaña no tiene sesión". La cookie de sesión es HttpOnly (el
 * navegador no la deja leer), así que la única forma de saberlo es preguntar al
 * API y recibir 401. Para no repetir ese 401 en cada ficha de producto que ve
 * una visitante anónima, se recuerda durante la pestaña; al ingresar se borra.
 */
const KEY = "eg-anonymous";

function isKnownAnonymous(): boolean {
  try {
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function markAnonymous(): void {
  try {
    window.sessionStorage.setItem(KEY, "1");
  } catch {
    // Sin almacenamiento (modo privado estricto): solo se pierde la optimización.
  }
}

function clearAnonymous(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Ver `markAnonymous`.
  }
}

export { isKnownAnonymous, markAnonymous, clearAnonymous };
