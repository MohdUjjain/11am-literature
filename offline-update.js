/* 11AM Literature: edition notifications separate from the dossier compositor. */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  let hadController = !!navigator.serviceWorker.controller;
  let lastCheck = 0;
  let registration = null;
  const notice = document.createElement('aside');
  notice.id = 'edition-notice';
  notice.className = 'app-chrome no-print';
  notice.hidden = true;
  notice.setAttribute('role','status');
  notice.setAttribute('aria-live','polite');
  notice.innerHTML = '<span>New Literature edition saved for offline reading.</span> ' +
    '<button type="button" id="edition-reload">Reload updated guide</button>' +
    '<button type="button" id="edition-dismiss" aria-label="Dismiss update notice">×</button>';
  document.body.appendChild(notice);
  notice.querySelector('#edition-reload').addEventListener('click',() => location.reload());
  notice.querySelector('#edition-dismiss').addEventListener('click',() => {notice.hidden=true;});
  function announce() { notice.hidden = false; }
  navigator.serviceWorker.addEventListener('controllerchange',() => {
    if (hadController) announce();
    hadController = true;
  });
  async function check() {
    if (!navigator.onLine || Date.now()-lastCheck < 60000) return;
    lastCheck = Date.now();
    try {
      if (!registration) registration = await navigator.serviceWorker.getRegistration('./');
      if (registration) await registration.update();
    } catch { /* The saved edition remains available offline. */ }
  }
  navigator.serviceWorker.ready.then(reg => { registration=reg; check(); }).catch(()=>{});
  window.addEventListener('online',check);
  document.addEventListener('visibilitychange',() => {if (!document.hidden) check();});
})();
