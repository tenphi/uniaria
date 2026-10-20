const form = document.getElementById('order');
const log = document.getElementById('log');

// Format options are a property only.
document.getElementById('price').formatOptions = {
  style: 'currency',
  currency: 'EUR',
};
// The sign is markup beside the input, so the format has none.
document.getElementById('deposit').formatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

form.addEventListener('valuechange', (event) => {
  log.textContent = `valuechange on ${event.target.id}: ${event.detail}`;
});

// The hidden inputs give the form plain numbers, whatever the text shows.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  log.textContent = `Submitted ${new URLSearchParams(new FormData(form))}`;
});
