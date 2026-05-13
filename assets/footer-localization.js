(function () {
  function init(root) {
    var selects = (root || document).querySelectorAll('[data-footer-localization]');
    selects.forEach(function (select) {
      if (select.dataset.bound === 'true') return;
      select.dataset.bound = 'true';
      select.addEventListener('change', function () {
        var form = select.closest('form');
        if (form) form.submit();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }

  document.addEventListener('shopify:section:load', function (e) { init(e.target); });
})();
