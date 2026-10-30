/* Optional videos (Science Buddies' "How to Use an Arduino" series).
   Each <figure class="video"> is a thumbnail link to YouTube, so it works without
   JavaScript. With JavaScript a click plays it in place, using YouTube's
   privacy-enhanced player, and nothing is downloaded until the learner asks.
   Offline, the box says so instead of showing a broken picture. */
(function () {
  function offline(fig) { fig.classList.add('v-offline'); }
  document.querySelectorAll('figure.video').forEach(function (fig) {
    var a = fig.querySelector('a.v-link');
    var img = fig.querySelector('img');
    if (img) {
      img.addEventListener('error', function () { offline(fig); });
      if (img.complete && !img.naturalWidth && location.protocol === 'file:' && !navigator.onLine) offline(fig);
    }
    if (!a) return;
    a.addEventListener('click', function (e) {
      if (!navigator.onLine) { e.preventDefault(); offline(fig); return; }
      e.preventDefault();
      var id = fig.getAttribute('data-yt');
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      f.title = fig.getAttribute('data-title') || 'Video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      f.loading = 'lazy';
      a.replaceWith(f);
      fig.classList.add('v-playing');
    });
  });
})();
