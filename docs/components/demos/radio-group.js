const log = document.getElementById('log');

document.addEventListener('valuechange', (event) => {
  log.textContent = `valuechange: ${event.detail}`;
});
