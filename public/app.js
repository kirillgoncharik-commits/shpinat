/* Booking links remain regular, working links without JavaScript. */
'use strict';
document.querySelectorAll('[data-booking]').forEach(link => {
  link.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('shpinat:booking-click', {
      detail: { placement: link.dataset.booking }
    }));
  });
});
document.querySelectorAll('.mobile-menu nav a').forEach(link => {
  link.addEventListener('click', () => {
    link.closest('details').open = false;
  });
});
