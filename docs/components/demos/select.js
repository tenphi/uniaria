const log = document.getElementById('log');
const form = document.getElementById('order');

document.addEventListener('valuechange', (event) => {
  log.textContent = `valuechange: ${event.detail.join(', ')}`;
});

// The hidden <select> submits the value, and `required` blocks an empty one.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  log.textContent = `Submitted fruit=${new FormData(form).get('fruit')}`;
});
