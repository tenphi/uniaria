---
'@uniaria/core': patch
---

Autocomplete, inline: in Safari, a pointer resting over the list no longer highlights the option under it when the page scrolls, as when a key scrolls the highlighted option into view. Safari sends a resting pointer a move after a scroll; only the pointer's real moves highlight now, as in other browsers.
