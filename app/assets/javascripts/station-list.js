;(function () {
  // Load station list asynchronously so the page doesn't block
  fetch('/monitoringStationInfo', { signal: AbortSignal.timeout(90000) })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (body) { throw new Error(body.error || 'Status ' + r.status) })
      return r.json()
    })
    .then(function (stations) {
      var list = Array.isArray(stations) ? stations
        : Array.isArray(stations.measurements) ? stations.measurements
          : Array.isArray(stations.data) ? stations.data
            : Array.isArray(stations.stations) ? stations.stations
              : Array.isArray(stations.results) ? stations.results
                : null
      if (!list) {
        throw new Error('Unexpected response shape: ' + JSON.stringify(stations).slice(0, 120))
      }
      if (window._onStationsLoaded) window._onStationsLoaded(list)
      var count = document.getElementById('stations-count')
      var content = document.getElementById('stations-content')
      if (count) count.textContent = '(' + list.length + ')'
      if (content) {
        // Group stations by area
        var areas = {}
        list.forEach(function (s) {
          var area = s.area || 'Other'
          if (!areas[area]) areas[area] = []
          areas[area].push(s)
        })

        var fragment = document.createDocumentFragment()
        Object.keys(areas).sort().forEach(function (areaName) {
          var details = document.createElement('details')
          details.className = 'govuk-details govuk-!-margin-bottom-2'

          var summary = document.createElement('summary')
          summary.className = 'govuk-details__summary'
          var summaryText = document.createElement('span')
          summaryText.className = 'govuk-details__summary-text'
          summaryText.textContent = areaName + ' (' + areas[areaName].length + ')'
          summary.appendChild(summaryText)
          details.appendChild(summary)

          var div = document.createElement('div')
          div.className = 'govuk-details__text'
          var ul = document.createElement('ul')
          ul.className = 'govuk-list govuk-list--bullet'

          areas[areaName].forEach(function (s) {
            var li = document.createElement('li')
            if (s.location && Array.isArray(s.location.coordinates)) {
              var btn = document.createElement('button')
              btn.className = 'govuk-link'
              btn.style.cssText = 'background:none;border:none;padding:0;cursor:pointer;font:inherit'
              btn.textContent = s.name
              btn.addEventListener('click', function () {
                window.navigateToStation(s)
              })
              li.appendChild(btn)
            } else {
              li.textContent = s.name
            }
            ul.appendChild(li)
          })

          div.appendChild(ul)
          details.appendChild(div)
          fragment.appendChild(details)
        })

        content.innerHTML = ''
        content.appendChild(fragment)
      }
    })
    .catch(function (err) {
      var msg = (err.name === 'TimeoutError' || err.name === 'AbortError')
        ? 'Connection timeout'
        : err.message
      var content = document.getElementById('stations-content')
      if (content) content.innerHTML = '<p class="govuk-body">Could not load monitoring stations: <code>' + msg + '</code></p>'
    })
})()
