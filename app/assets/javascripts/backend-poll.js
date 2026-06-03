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

  function updateEndpoints(endpoints) {
    var container = document.getElementById('endpoint-status')
    if (!container || !Array.isArray(endpoints)) return
    container.innerHTML = endpoints.map(function (ep) {
      var label = ep.ok
        ? 'OK' + (ep.count != null ? ' (' + ep.count + ')' : '')
        : (ep.error || 'Error')
      var colour = ep.ok ? 'govuk-tag--green' : 'govuk-tag--red'
      return '<span style="font-family:monospace;font-size:0.875rem;">' +
        ep.name + ' <strong class="govuk-tag ' + colour + '">' + label + '</strong></span>'
    }).join('')
  }

  function poll() {
    fetch('/api/health')
      .then(function (r) { return r.json() })
      .then(function (data) { updateBanner(data.connected, data.url) })
      .catch(function () { updateBanner(false) })
  }

  function pollEndpoints() {
    fetch('/api/endpoints')
      .then(function (r) { return r.json() })
      .then(function (data) { updateEndpoints(data) })
      .catch(function () {})
  }

  setInterval(poll, 3000)
  setInterval(pollEndpoints, 30000)
})()
