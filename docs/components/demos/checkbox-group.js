// The group is invalid while nothing is selected: its error shows, is
// announced, and is linked to every checkbox.
const group = document.getElementById('notify');
const log = document.getElementById('log');

group.addEventListener('valuechange', (event) => {
  group.isInvalid = event.detail.length === 0;
  log.textContent = `valuechange: ${JSON.stringify(event.detail)}`;
});
