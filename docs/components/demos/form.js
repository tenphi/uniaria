// The form holds the values and checks them; the fields show the errors.
const signup = document.getElementById('signup');
const log = document.getElementById('log');

document.getElementById('email').validationMessages = {
  valueMissing: 'Enter your email.',
  typeMismatch: 'Enter an email like jane@example.com.',
};
document.getElementById('password').validationMessages = {
  valueMissing: 'Choose a password.',
  tooShort: ({ min }) => `Use at least ${min} characters.`,
};
document.getElementById('terms').validationMessages = {
  valueMissing: 'Accept the terms to continue.',
};

// A server that knows one address already. An error it returns for a field
// shows on that field; one for the whole form shows in the form's error.
signup.handleSubmit = async (values, { signal }) => {
  log.textContent = 'Signing up…';
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (signal.aborted) return;
  if (values.email === 'taken@example.com') {
    signup.setFieldErrors('email', ['This email already has an account.']);
    signup.focusInvalid();
    log.textContent = 'Fix the marked field.';
    return;
  }
  log.textContent = `Signed up as ${values.email}.`;
};

signup.addEventListener('submitfailed', (event) => {
  if (event.detail.status === 'invalid') {
    log.textContent = 'Fix the marked fields.';
  }
});
signup.addEventListener('valueschange', (event) => {
  if (event.detail.kind === 'reset')
    log.textContent = 'The form is empty again.';
});
