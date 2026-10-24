const fruit = document.getElementById('fruit');
const log = document.getElementById('log');

// `defaultValue` is a property: markup has no attribute for it.
fruit.defaultValue = ['banana'];

let value = fruit.defaultValue;
let text = '';

const show = () => {
  log.textContent = `value: [${value.join(', ')}] · text: “${text}”`;
};

// Enter or a press toggles an option; the text only filters the list.
fruit.addEventListener('valuechange', (event) => {
  value = event.detail;
  show();
});
fruit.addEventListener('inputchange', (event) => {
  text = event.detail;
  show();
});
