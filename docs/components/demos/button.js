const log = document.getElementById('log');

document.addEventListener('press', (event) => {
  // The pressed button's name: its aria-label, its label part or its text.
  const root = event.target.querySelector('[data-uni="button"]');
  const label = root.querySelector('[data-element="Label"]') ?? root;
  const name = root.getAttribute('aria-label') ?? label.textContent.trim();
  log.textContent = `${name}: press, ${event.detail.pointerType}`;
});
