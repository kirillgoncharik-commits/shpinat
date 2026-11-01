/* Booking links remain regular, working links without JavaScript. */
'use strict';
document.querySelectorAll('.mobile-menu nav a').forEach(link => {
  link.addEventListener('click', () => {
    link.closest('details').open = false;
  });
});
