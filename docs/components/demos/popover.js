const log = document.getElementById('log');
const nameOf = (event) =>
  event.target.querySelector('[data-uni-part="popover-trigger"]').textContent;

document.addEventListener('openchange', (event) => {
  if (event.detail) log.textContent = `${nameOf(event)}: open`;
});
document.addEventListener('dismiss', (event) => {
  log.textContent = `${nameOf(event)}: dismiss, ${event.detail.reason}`;
});
document.getElementById('copy').addEventListener('press', () => {
  log.textContent = 'Share: link copied';
});
