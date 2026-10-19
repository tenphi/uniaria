const sample = document.getElementById('sample');
const log = document.getElementById('log');

document.addEventListener('selectedchange', (event) => {
  const name = event.target.textContent.trim();
  sample.classList.toggle(name.toLowerCase(), event.detail);
  log.textContent = `${name}: selectedchange, ${event.detail}`;
});
