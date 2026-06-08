/* article.js
 * Progressive enhancement for sections/article.liquid.
 * Wraps merchant-inserted <iframe> embeds (YouTube, Vimeo, etc.) in a
 * responsive 16:9 container so videos scale cleanly on mobile. Works on
 * first load and re-runs when the article section is reloaded in the
 * theme editor. No external dependencies.
 */
(function () {
  function wrapEmbeds(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var frames = scope.querySelectorAll('.article__body iframe');

    for (var i = 0; i < frames.length; i++) {
      var frame = frames[i];

      if (frame.closest('.article__embed')) {
        continue;
      }

      var wrap = document.createElement('div');
      wrap.className = 'article__embed';
      frame.parentNode.insertBefore(wrap, frame);
      wrap.appendChild(frame);
    }
  }

  function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  function initComposer(scope) {
    var areas = scope.querySelectorAll('.article__composer-bar textarea');

    for (var i = 0; i < areas.length; i++) {
      var area = areas[i];

      if (area.dataset.autogrow) {
        continue;
      }

      area.dataset.autogrow = '1';
      autoGrow(area);
      area.addEventListener('input', function () {
        autoGrow(this);
      });
    }
  }

  function init(root) {
    wrapEmbeds(root);
    initComposer(root && root.querySelectorAll ? root : document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }

  // Theme editor: re-process when the article section is re-rendered.
  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
})();
