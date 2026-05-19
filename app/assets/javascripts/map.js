; (function () {
  window.interactiveMap = new defra.InteractiveMap('map', {
    mapProvider: defra.maplibreProvider(),
    behaviour: 'hybrid',
    mapLabel: 'United Kingdom',
    zoom: 5.4842222,
    center: [-1.4649, 52.5619],
    containerHeight: '100%',
    mapStyle: {
      url: 'https://tiles.openfreemap.org/styles/liberty',
      attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
      backgroundColor: '#f5f5f0'
    }
  })

  var _mapReady = false
  var _stationList = null
  var _forecastList = null
  var _measurementsMap = {}   // keyed by localSiteID
  var _selectedId = null
  var _pendingNav = null

  // Fetch measurements to derive per-station pollutant lists
  fetch('/measurements')
    .then(function (r) { return r.ok ? r.json() : null })
    .then(function (data) {
      if (!data) return
      var list = Array.isArray(data) ? data
        : Array.isArray(data.measurements) ? data.measurements
          : []
      list.forEach(function (m) {
        if (m.name) _measurementsMap[m.name.trim().toLowerCase()] = m
      })
    })
    .catch(function () { /* measurements optional */ })

  // Fetch forecasts in parallel — used to colour markers and enrich the station panel
  fetch('/forecasts')
    .then(function (r) { return r.ok ? r.json() : null })
    .then(function (data) {
      if (!data) return
      _forecastList = Array.isArray(data) ? data
        : Array.isArray(data.forecasts) ? data.forecasts
          : Array.isArray(data.measurements) ? data.measurements
            : null
      if (_mapReady && _stationList) _plotAllMarkers()
    })
    .catch(function () { /* forecasts optional — panel still works without */ })

  // Called from station-list.js once the station list is available
  window._onStationsLoaded = function (list) {
    _stationList = list
    if (_mapReady) _plotAllMarkers()
  }

  window.interactiveMap.on('map:ready', function () {
    _mapReady = true
    if (_stationList) _plotAllMarkers()
    if (_pendingNav) {
      _highlightStation(_pendingNav)
      _pendingNav = null
    }
  })

  // API returns coordinates as [lat, lng] strings; map needs [lng, lat] numbers
  function _stationCoords(station) {
    var raw = station.location.coordinates
    return [parseFloat(raw[1]), parseFloat(raw[0])]
  }

  var _DAQI_BG = [null, '#00703c', '#00703c', '#00703c', '#ffdd00', '#ffdd00', '#ffdd00', '#d4351c', '#d4351c', '#d4351c', '#0b0c0c']

  function _daqiMarkerOptions(daqiValue, selected) {
    var bg = (daqiValue && _DAQI_BG[daqiValue]) ? _DAQI_BG[daqiValue] : (selected ? '#555555' : '#777777')
    var strokeAttr = selected
      ? 'stroke="#0b0c0c" stroke-width="2"'
      : 'stroke="white" stroke-width="2"'
    var textFill = (bg === '#ffdd00') ? '#0b0c0c' : '#ffffff'
    var label = daqiValue ? '<text x="19" y="24" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="' + textFill + '">' + daqiValue + '</text>' : ''
    var shadow = '<defs><filter id="ds" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/></filter></defs>'
    var svgContent = shadow + '<circle cx="19" cy="19" r="14" fill="' + bg + '" ' + strokeAttr + ' filter="url(#ds)"/>' + label
    return {
      symbolSvgContent: svgContent,
      viewBox: '0 0 38 38',
      anchor: [0.5, 0.5]
    }
  }

  function _stationDaqi(station) {
    var forecast = _forecastForStation(station)
    if (forecast && Array.isArray(forecast.forecast) && forecast.forecast.length > 0) {
      return forecast.forecast[0].value
    }
    return null
  }

  function _plotAllMarkers() {
    _stationList.forEach(function (s) {
      if (!s.location || !Array.isArray(s.location.coordinates)) return
      var id = 'ms-' + s.localSiteID
      if (id === _selectedId) return
      window.interactiveMap.addMarker(id, _stationCoords(s), _daqiMarkerOptions(_stationDaqi(s), false))
    })
  }

  function _highlightStation(station) {
    if (_selectedId && _stationList) {
      var prev = _stationList.find(function (s) { return 'ms-' + s.localSiteID === _selectedId })
      if (prev) {
        window.interactiveMap.addMarker(_selectedId, _stationCoords(prev), _daqiMarkerOptions(_stationDaqi(prev), false))
      }
    }
    _selectedId = 'ms-' + station.localSiteID
    window.interactiveMap.addMarker(_selectedId, _stationCoords(station), _daqiMarkerOptions(_stationDaqi(station), true))
    _showStationPanel(station)
  }

  // Maps measurement keys → canonical display names. Multiple codes can map to the
  // same display name (e.g. GE10/GR10 are both PM10 variants); duplicates are removed.
  var _POLLUTANT_LABELS = {
    NO2:  'NO₂',
    O3:   'O₃',
    SO2:  'SO₂',
    PM25: 'PM2.5',
    GE10: 'PM10',   // Gravimetric Equivalent PM10
    GR10: 'PM10',   // Gravimetric Reference PM10
    GR25: 'PM2.5'   // Gravimetric Reference PM2.5
  }
  var _DAQI_BAND = [
    null,
    'Low', 'Low', 'Low',
    'Moderate', 'Moderate', 'Moderate',
    'High', 'High', 'High',
    'Very High'
  ]

  // Find the forecast entry nearest to a station (within 0.05 degrees)
  function _forecastForStation(station) {
    if (!_forecastList || !station.location) return null
    var sLat = parseFloat(station.location.coordinates[0])
    var sLng = parseFloat(station.location.coordinates[1])
    var best = null
    var bestDist = 0.05 * 0.05
    _forecastList.forEach(function (f) {
      if (!f.location || !Array.isArray(f.location.coordinates)) return
      var fLat = parseFloat(f.location.coordinates[0])
      var fLng = parseFloat(f.location.coordinates[1])
      var d = (fLat - sLat) * (fLat - sLat) + (fLng - sLng) * (fLng - sLng)
      if (d < bestDist) { bestDist = d; best = f }
    })
    return best
  }

  function _formatDate(dateStr) {
    if (!dateStr) return ''
    var d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  function _showStationPanel(station) {
    var panel = document.getElementById('station-panel')
    if (!panel) return

    var status = (station.stationStatus || station.status || station.siteStatus || '').toLowerCase()
    var isClosed = status === 'closed'
    var tagLabel = status === 'current' ? 'Active'
      : status ? status.charAt(0).toUpperCase() + status.slice(1) : ''
    var tagClass = status === 'current' ? 'aq-station-tag--active'
      : isClosed ? 'aq-station-tag--closed' : ''
    var tag = tagClass
      ? ' <strong class="aq-station-tag ' + tagClass + '">' + tagLabel + '</strong>'
      : ''

    document.getElementById('sp-name').innerHTML = _escapeHtml(station.name || '') + tag

    var rows = []

    // Derive pollutant list from measurements data joined on station name
    var measured = (_measurementsMap[(station.name || '').trim().toLowerCase()] || {}).pollutants || {}
    var seen = []
    Object.keys(_POLLUTANT_LABELS).forEach(function (k) {
      if (measured[k] !== undefined) {
        var label = _POLLUTANT_LABELS[k]
        if (seen.indexOf(label) === -1) seen.push(label)
      }
    })
    if (seen.length > 0) rows.push(['Pollutants', seen.join(', ')])

    if (!isClosed) {
      var forecast = _forecastForStation(station)
      if (forecast && Array.isArray(forecast.forecast) && forecast.forecast.length > 0) {
        var todayValue = forecast.forecast[0].value
        var band = _DAQI_BAND[todayValue] || ''
        var bandKey = band.toLowerCase().replace(' ', '')
        var daqiClass = bandKey ? 'aq-daqi-tag aq-daqi-tag--' + bandKey : 'aq-daqi-tag'
        var daqiHtml = '<span class="' + daqiClass + '">' + todayValue + (band ? ' (' + band.toLowerCase() + ')' : '') + '</span>'
        rows.push(['DAQI', daqiHtml, true])
      }
    }

    var authority = station.localAuthority || station.localAuthorityName || station.authority || station.owner || ''
    rows.push(['Local authority', authority || 'Not available'])
    if (station.areaType) rows.push(['Site type', station.areaType])

    var startDate = station.startDate || station.openingDate || station.dateOpened || ''
    rows.push(['Start date', startDate ? _formatDate(startDate) : 'Not available'])

    if (isClosed) {
      var endDate = station.endDate || station.closingDate || station.dateClosed || ''
      rows.push(['End date', endDate ? _formatDate(endDate) : 'Not available'])
    }

    var dl = document.getElementById('sp-details')
    dl.innerHTML = rows.map(function (r) {
      return '<div class="aq-station-info-row">'
        + '<dt>' + _escapeHtml(r[0]) + ':</dt> '
        + '<dd>' + (r[2] ? r[1] : _escapeHtml(String(r[1]))) + '</dd>'
        + '</div>'
    }).join('')

    panel.classList.add('visible')
    _hideKeyOverlay(false)
  }

  function _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // MAP_CLICK: highlight the nearest station if the click is within ~0.1 degrees
  window.interactiveMap.on('map:click', function (evt) {
    if (!_stationList || !evt || !evt.coords) return
    var clickLng = evt.coords[0]
    var clickLat = evt.coords[1]
    var best = null
    var bestDist = Infinity
    _stationList.forEach(function (s) {
      if (!s.location || !Array.isArray(s.location.coordinates)) return
      var lat = parseFloat(s.location.coordinates[0])
      var lng = parseFloat(s.location.coordinates[1])
      var d = (lng - clickLng) * (lng - clickLng) + (lat - clickLat) * (lat - clickLat)
      if (d < bestDist) { bestDist = d; best = s }
    })
    // sqrt(0.01) ≈ 0.1 degrees ≈ 11 km — reasonable click target at mid zoom
    if (best && bestDist < 0.01) _highlightStation(best)
  })

  window.navigateToStation = function (station) {
    if (_mapReady) {
      _highlightStation(station)
    } else {
      _pendingNav = station
      window.interactiveMap.open()
    }
  }

  // Map key / legend panel
  function _renderKeyOverlay() {
    var body = document.getElementById('map-key-body')
    if (!body) return
    body.innerHTML =
      '<div class="aq-daqi-scale">' +
        '<div class="aq-daqi-scale__bands">' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--green">1</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--green">2</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--green">3</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--yellow">4</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--yellow">5</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--yellow">6</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--red">7</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--red">8</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--red">9</div>' +
          '<div class="aq-daqi-scale__band aq-daqi-scale__band--black">10</div>' +
        '</div>' +
        '<div class="aq-daqi-scale__labels">' +
          '<div class="aq-daqi-scale__label-group aq-daqi-scale__label-group--low">' +
            '<span class="aq-daqi-scale__level">Low</span>' +
            '<span class="aq-daqi-scale__range">1 to 3</span>' +
          '</div>' +
          '<div class="aq-daqi-scale__label-group aq-daqi-scale__label-group--moderate">' +
            '<span class="aq-daqi-scale__level">Moderate</span>' +
            '<span class="aq-daqi-scale__range">4 to 6</span>' +
          '</div>' +
          '<div class="aq-daqi-scale__label-group aq-daqi-scale__label-group--high">' +
            '<span class="aq-daqi-scale__level">High</span>' +
            '<span class="aq-daqi-scale__range">7 to 9</span>' +
          '</div>' +
          '<div class="aq-daqi-scale__label-group aq-daqi-scale__label-group--veryhigh">' +
            '<span class="aq-daqi-scale__level">Very high</span>' +
            '<span class="aq-daqi-scale__range">10</span>' +
          '</div>' +
        '</div>' +
      '</div>'
  }

  var _keyClosedByUser = false

  function _showKeyOverlay() {
    var overlay = document.getElementById('map-key-overlay')
    if (overlay) overlay.hidden = false
  }

  function _hideKeyOverlay(byUser) {
    var overlay = document.getElementById('map-key-overlay')
    if (overlay) overlay.hidden = true
    if (byUser) {
      _keyClosedByUser = true
    }
  }

  _renderKeyOverlay()

  document.getElementById('map-key-close').addEventListener('click', function () {
    _hideKeyOverlay(true)
  })

  document.getElementById('key-button').addEventListener('click', function () {
    var overlay = document.getElementById('map-key-overlay')
    if (overlay && overlay.hidden) {
      _keyClosedByUser = false
      _showKeyOverlay()
    } else {
      _hideKeyOverlay(true)
    }
  })

  var _spClose = document.getElementById('sp-close')
  _spClose.addEventListener('click', function () {
    document.getElementById('station-panel').classList.remove('visible')
    if (!_keyClosedByUser) _showKeyOverlay()
  })
})()
