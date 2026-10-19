// Field shows validation state; the form decides it. This form checks on
// submit, then again on every edit.
const form = document.getElementById('signup');
const emailField = document.getElementById('email-field');
const email = document.getElementById('email');
const emailError = emailField.querySelector('[data-element="Error"]');
const terms = document.getElementById('terms');
const log = document.getElementById('log');
let wasSubmitted = false;

function validate() {
  const value = email.value.trim();
  const message =
    value === ''
      ? 'Enter your email.'
      : 'Enter an email like jane@example.com.';
  // New text while the error is shown is announced too.
  if (emailError.textContent !== message) emailError.textContent = message;
  emailField.toggleAttribute('invalid', value === '' || !email.validity.valid);
  terms.toggleAttribute('invalid', !form.elements.terms.checked);
  return !emailField.hasAttribute('invalid') && !terms.hasAttribute('invalid');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  wasSubmitted = true;
  log.textContent = validate()
    ? `Signed up as ${email.value.trim()}.`
    : 'Fix the marked fields.';
});
const revalidate = () => {
  if (wasSubmitted) validate();
};
email.addEventListener('input', revalidate);
terms.addEventListener('selectedchange', revalidate);
