const log = document.getElementById('log');

document.addEventListener('selectedchange', (event) => {
  const label = event.target.querySelector('[data-element="Label"]');
  log.textContent = `${label.textContent}: selectedchange, ${event.detail}`;
});
