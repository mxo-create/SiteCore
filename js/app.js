// Minimal app renderer for debug
(function () {
  try {
    const header = document.getElementById('header');
    const main = document.getElementById('main');

    const title = (window.SiteCoreData && window.SiteCoreData.title) || 'SiteCore';
    const content = (window.SiteCoreData && window.SiteCoreData.contentHtml) || '<p>No content</p>';

    if (header) header.innerHTML = '<div class="site-title"><h1>' + title + '</h1></div>';
    if (main) main.innerHTML = content;

    console.log('app.js loaded — rendered debug content');
  } catch (err) {
    console.error('app.js error', err);
  }
})();
