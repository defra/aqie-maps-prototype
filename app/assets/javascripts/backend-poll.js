; (function () {
  function updateBanner(connected, url) {
    var banner = document.getElementById('backend-banner')
    var tag = document.getElementById('backend-tag')
    var urlEl = document.getElementById('backend-url')
    if (!banner || !tag) return
    if (connected) {
      banner.style.borderLeftColor = '#00703c'
      banner.style.background = '#f3faf3'
      tag.className = 'govuk-tag govuk-tag--green govuk-!-margin-left-2'
      tag.textContent = 'Connected'
    } else {
      banner.style.borderLeftColor = '#d4351c'
      banner.style.background = '#fff5f5'
      tag.className = 'govuk-tag govuk-tag--red govuk-!-margin-left-2'
      tag.textContent = 'Not Connected'
    }
    if (urlEl && url) urlEl.textContent = url
  }

  function poll() {
    fetch('/api/health')
      .then(function (r) { return r.json() })
      .then(function (data) { updateBanner(data.connected, data.url) })
      .catch(function () { updateBanner(false) })
  }

  setInterval(poll, 3000)
})()
