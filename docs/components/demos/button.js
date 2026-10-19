const log = document.getElementById('log');

document.addEventListener('press', (event) => {
  const name = event.target.textContent.trim();
  log.textContent = `${name}: press, ${event.detail.pointerType}`;
});
