const log = document.getElementById('log');

// `defaultValue` is a property: markup has no attribute for it.
document.getElementById('toppings').defaultValue = ['cheese', 'basil'];

document.addEventListener('valuechange', (event) => {
  const label = event.target.querySelector('[data-element="Label"]');
  const keys = event.detail.length ? event.detail.join(', ') : 'nothing';
  log.textContent = `${label.textContent}: ${keys}`;
});
