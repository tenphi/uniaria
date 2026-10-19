const dialog = document.querySelector('uni-dialog');
const log = document.getElementById('log');

// Controlled, so the Delete action can close it.
dialog.isOpen = false;
dialog.addEventListener('openchange', (event) => {
  dialog.isOpen = event.detail;
});
dialog.addEventListener('dismiss', (event) => {
  log.textContent = `dismiss: ${event.detail.reason}`;
});
document.getElementById('delete').addEventListener('press', () => {
  dialog.isOpen = false;
  log.textContent = 'Deleted “report.pdf”.';
});
