const log = document.getElementById('log');
const nameOf = (event) =>
  event.target.querySelector('[data-element="Trigger"]').textContent;

document.addEventListener('openchange', (event) => {
  if (event.detail) log.textContent = `${nameOf(event)}: open`;
});
document.addEventListener('dismiss', (event) => {
  log.textContent = `${nameOf(event)}: dismiss, ${event.detail.reason}`;
});
document.querySelector('.copy').addEventListener('click', () => {
  log.textContent = 'Share: link copied';
});
