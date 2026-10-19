const username = document.getElementById('username');
const bio = document.getElementById('bio');
const count = bio.querySelector('[data-element="Description"]');
const log = document.getElementById('log');
const isValid = (value) => /^\w*$/.test(value);

// Check on blur, as many forms do; once invalid, check on every change.
username.addEventListener('focuschange', (event) => {
  log.textContent = `focuschange: ${event.detail}`;
  if (!event.detail) {
    username.toggleAttribute(
      'invalid',
      !isValid(username.instance.getState().value),
    );
  }
});
username.addEventListener('valuechange', (event) => {
  log.textContent = `valuechange: "${event.detail}"`;
  if (username.hasAttribute('invalid') && isValid(event.detail)) {
    username.removeAttribute('invalid');
  }
});

bio.addEventListener('valuechange', (event) => {
  count.textContent = `${event.detail.length} of 160 characters`;
});
