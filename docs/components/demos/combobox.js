const log = document.getElementById('log');
let value = [];
let text = '';

const show = () => {
  log.textContent = `value: [${value.join(', ')}] · text: “${text}”`;
};

// The value settles on a choice, Enter or blur; the text changes as you type.
document.addEventListener('valuechange', (event) => {
  value = event.detail;
  show();
});
document.addEventListener('inputchange', (event) => {
  text = event.detail;
  show();
});
