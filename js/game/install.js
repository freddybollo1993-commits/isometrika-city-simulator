/**
 * INSTALAR EL JUEGO EN EL MÓVIL (aplicación web)
 * Registra el service worker (sw.js), que guarda el juego para abrirlo sin conexión, y gestiona el
 * botón «Instalar» de la pantalla de inicio: en Chrome, Edge y Samsung Internet abre el diálogo de
 * instalación del navegador; en Firefox y Safari, que no lo ofrecen a la página, explica dónde está la
 * opción en el menú. El botón se oculta cuando el juego ya se abre como aplicación instalada.
 */

/** ¿Se está ejecutando como aplicación instalada (desde el icono de la pantalla de inicio)? */
export function isStandalone(win = globalThis) {
  const mq = (q) => !!(win.matchMedia && win.matchMedia(q).matches);
  return mq('(display-mode: fullscreen)') || mq('(display-mode: standalone)') || win.navigator?.standalone === true;
}

/** Dónde está la opción de instalar en cada navegador (cuando no hay diálogo propio). */
export function installHelp(ua = '') {
  const s = String(ua);
  if (/iPhone|iPad|iPod/i.test(s)) return '📲 En Safari: botón Compartir ⬆️ → «Añadir a pantalla de inicio»';
  if (/Firefox|FxiOS/i.test(s)) return '📲 En Firefox: menú ⋮ → «Instalar» (o «Añadir a pantalla de inicio»)';
  if (/SamsungBrowser/i.test(s)) return '📲 En Samsung Internet: menú ≡ → «Añadir página a» → «Pantalla de inicio»';
  if (/Android/i.test(s)) return '📲 En el navegador: menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio»';
  return '📲 En el ordenador: icono de instalar en la barra de direcciones, o menú del navegador → «Instalar ISOMETRICA»';
}

/** Registra el service worker cuando la página ya cargó (no compite con el arranque del juego). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const go = () => navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Sin modo sin conexión:', err));
  if (document.readyState === 'complete') go();
  else window.addEventListener('load', go, { once: true });
}

/**
 * Prepara el botón «Instalar».
 * @param {HTMLElement|null} button
 * @param {(msg: string) => void} toast
 */
export function setupInstallButton(button, toast) {
  if (!button) return;
  let deferred = null; // aviso de instalación que guarda el navegador hasta que el jugador lo pide
  const refresh = () => { button.hidden = isStandalone(); };
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    refresh();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    button.hidden = true;
    toast('📲 ISOMETRICA instalado: ábrelo desde el icono de tu pantalla de inicio');
  });
  button.addEventListener('click', async () => {
    if (deferred) {
      const prompt = deferred;
      deferred = null;
      prompt.prompt();
      const choice = await prompt.userChoice.catch(() => null);
      if (choice && choice.outcome !== 'accepted') toast('Puedes instalarlo cuando quieras desde este botón');
      return;
    }
    toast(installHelp(navigator.userAgent));
  });
  refresh();
}
