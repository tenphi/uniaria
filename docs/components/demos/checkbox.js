// "All toppings" is computed from the rows: selected when every row is,
// indeterminate when some are. Every checkbox here is controlled.
const all = document.getElementById('all');
const rows = [...document.querySelectorAll('.topping')];
const log = document.getElementById('log');

function update() {
  const count = rows.filter((row) => row.isSelected).length;
  all.isSelected = count === rows.length;
  all.isIndeterminate = count > 0 && count < rows.length;
  log.textContent = `${count} of ${rows.length} selected`;
}

for (const row of rows) {
  // Start from what the markup checked.
  row.isSelected = row.instance.getState().isSelected;
  row.addEventListener('selectedchange', (event) => {
    row.isSelected = event.detail;
    update();
  });
}
all.addEventListener('selectedchange', (event) => {
  for (const row of rows) row.isSelected = event.detail;
  update();
});
update();
