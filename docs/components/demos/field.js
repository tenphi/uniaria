// Field shows validation state; the form decides it. This form checks on
// submit, then again on every change.
const form = document.getElementById('order');
const countryField = document.getElementById('country-field');
const country = document.getElementById('country');
const terms = document.getElementById('terms');
const log = document.getElementById('log');
let wasSubmitted = false;

function validate() {
  countryField.toggleAttribute('invalid', country.value === '');
  terms.toggleAttribute('invalid', !form.elements.terms.checked);
  return (
    !countryField.hasAttribute('invalid') && !terms.hasAttribute('invalid')
  );
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  wasSubmitted = true;
  log.textContent = validate()
    ? `Ordered for ${country.selectedOptions[0].textContent}.`
    : 'Fix the marked fields.';
});
const revalidate = () => {
  if (wasSubmitted) validate();
};
country.addEventListener('change', revalidate);
terms.addEventListener('selectedchange', revalidate);
