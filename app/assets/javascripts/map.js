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

  var _DAQI_POLLUTANTS = [
    { label: 'Fine particulate matter (PM2.5)', codes: ['PM25', 'GR25'] },
    { label: 'Particulate matter (PM10)',        codes: ['GE10', 'GR10'] },
    { label: 'Nitrogen dioxide (NO2)',           codes: ['NO2'] },
    { label: 'Ozone (O3)',                       codes: ['O3'] },
    { label: 'Sulphur dioxide (SO2)',            codes: ['SO2'] }
  ]
  var _filterState = {
    mode: 'daqi',
    selected: new Set(['NO2', 'O3', 'SO2', 'PM25', 'GE10', 'GR10', 'GR25'])
  }
  var _plottedIds = new Set()
  var _showInactiveStations = true

  fetch('/measurements')
    .then(function (response) { return response.ok ? response.json() : null })
    .then(function (data) {
      if (!data) return
      var list = Array.isArray(data) ? data
        : Array.isArray(data.measurements) ? data.measurements
          : []
      list.forEach(function (measurement) {
        if (measurement.name) _measurementsMap[measurement.name.trim().toLowerCase()] = measurement
      })
      // Re-plot now that pollutant data is available for accurate filtering
      if (_mapReady && _stationList) _plotAllMarkers()
    })
    .catch(function () { /* measurements optional */ })

  fetch('/forecasts')
    .then(function (response) { return response.ok ? response.json() : null })
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
    var status = (station.stationStatus || station.status || station.siteStatus || '').toLowerCase()
    if (status === 'closed') return null
    var forecast = _forecastForStation(station)
    if (forecast && Array.isArray(forecast.forecast) && forecast.forecast.length > 0) {
      return forecast.forecast[0].value
    }
    return null
  }

  // Falls back to visible when measurement data has not yet loaded for a station.
  function _stationMatchesFilter(station) {
    if (!_showInactiveStations) {
      var status = (station.stationStatus || station.status || station.siteStatus || '').toLowerCase()
      if (status && status !== 'current' && status !== 'active') return false
    }
    if (_filterState.mode === 'other') return true
    if (_filterState.selected.size === 0) return false
    var stationName = (station.name || '').trim().toLowerCase()
    var measured = _measurementsMap[stationName]
    if (!measured) return true  // no data yet — keep station visible
    var codes = Object.keys(measured.pollutants || {})
    if (codes.length === 0) return true
    return codes.some(function (code) { return _filterState.selected.has(code) })
  }

  function _plotAllMarkers() {
    var nextPlotted = new Set()
    _stationList.forEach(function (station) {
      if (!station.location || !Array.isArray(station.location.coordinates)) return
      var id = 'ms-' + station.localSiteID
      // Always keep the currently selected station on the map
      if (id === _selectedId) {
        nextPlotted.add(id)
        return
      }
      if (_stationMatchesFilter(station)) {
        window.interactiveMap.addMarker(id, _stationCoords(station), _daqiMarkerOptions(_stationDaqi(station), false))
        nextPlotted.add(id)
      }
    })
    _plottedIds.forEach(function (id) {
      if (!nextPlotted.has(id)) {
        window.interactiveMap.removeMarker(id)
      }
    })
    _plottedIds = nextPlotted
  }

  function _highlightStation(station) {
    if (_selectedId && _stationList) {
      var prev = _stationList.find(function (candidate) { return 'ms-' + candidate.localSiteID === _selectedId })
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
    NO2: 'NO₂',
    O3: 'O₃',
    SO2: 'SO₂',
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
    _forecastList.forEach(function (forecastEntry) {
      if (!forecastEntry.location || !Array.isArray(forecastEntry.location.coordinates)) return
      var fLat = parseFloat(forecastEntry.location.coordinates[0])
      var fLng = parseFloat(forecastEntry.location.coordinates[1])
      var squaredDist = (fLat - sLat) * (fLat - sLat) + (fLng - sLng) * (fLng - sLng)
      if (squaredDist < bestDist) { bestDist = squaredDist; best = forecastEntry }
    })
    return best
  }

  function _formatDate(dateStr) {
    if (!dateStr) return ''
    var date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
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
    Object.keys(_POLLUTANT_LABELS).forEach(function (pollutantCode) {
      if (measured[pollutantCode] !== undefined) {
        var label = _POLLUTANT_LABELS[pollutantCode]
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

    rows.push(['Local authority', station.localAuthority || 'Not available'])
    if (station.areaType) rows.push(['Site type', station.areaType])

    // startDate comes from the earliest pollutant startDate in measurements data
    var pollutantDates = Object.keys(measured).map(function (pollutantCode) { return measured[pollutantCode].startDate || '' })
      .filter(function (dateValue) { return dateValue && dateValue !== 'null' })
    pollutantDates.sort()
    var startDate = pollutantDates[0] || ''
    rows.push(['Start date', startDate ? _formatDate(startDate) : 'Not available'])

    if (isClosed) {
      var pollutantEndDates = Object.keys(measured).map(function (pollutantCode) { return measured[pollutantCode].endDate || '' })
        .filter(function (dateValue) { return dateValue && dateValue !== 'null' })
      pollutantEndDates.sort()
      var endDate = pollutantEndDates[pollutantEndDates.length - 1] || ''
      rows.push(['End date', endDate ? _formatDate(endDate) : 'Not available'])
    }

    var dl = document.getElementById('sp-details')
    dl.innerHTML = rows.map(function (row) {
      return '<div class="aq-station-info-row">'
        + '<dt>' + _escapeHtml(row[0]) + ':</dt> '
        + '<dd>' + (row[2] ? row[1] : _escapeHtml(String(row[1]))) + '</dd>'
        + '</div>'
    }).join('')

    panel.classList.add('visible')
    _hideKeyOverlay(false)

  }

  function _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  window.interactiveMap.on('map:click', function (evt) {
    if (!_stationList || !evt || !evt.coords) return
    var clickLng = evt.coords[0]
    var clickLat = evt.coords[1]
    var best = null
    var bestDist = Infinity
    _stationList.forEach(function (station) {
      if (!station.location || !Array.isArray(station.location.coordinates)) return
      var lat = parseFloat(station.location.coordinates[0])
      var lng = parseFloat(station.location.coordinates[1])
      var squaredDist = (lng - clickLng) * (lng - clickLng) + (lat - clickLat) * (lat - clickLat)
      if (squaredDist < bestDist) { bestDist = squaredDist; best = station }
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

  var _spClose = document.getElementById('sp-close')
  _spClose.addEventListener('click', function () {
    document.getElementById('station-panel').classList.remove('visible')
    if (!_keyClosedByUser) _showKeyOverlay()
  })

  function _initKeyOverlay() {
    var overlay = document.getElementById('map-key-overlay')
    if (!overlay) return
    overlay.innerHTML =
      '<button id="map-key-close" class="aq-map-key__close" aria-label="Close map key">'
      + '<svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20">'
      + '<path d="M10,8.6L15.6,3L17,4.4L11.4,10L17,15.6L15.6,17L10,11.4L4.4,17L3,15.6L8.6,10L3,4.4L4.4,3L10,8.6Z"/>'
      + '</svg>'
      + '<span class="govuk-visually-hidden">Close map key</span>'
      + '</button>'
      + '<div class="aq-map-key__body">'
      + '<h2 class="govuk-heading-s govuk-!-margin-bottom-1">Map key</h2>'
      + '<p class="govuk-body-s govuk-!-margin-bottom-2" id="map-key-subtitle">Daily Air Quality Index (DAQI)</p>'
      + '<div id="map-key-body"></div>'
      + '</div>'
    _renderKeyOverlay()
    document.getElementById('map-key-close').addEventListener('click', function () {
      _hideKeyOverlay(true)
    })
  }

  function _initReopenStack() {
    var stack = document.querySelector('.reopen-stack')
    if (!stack) return
    stack.innerHTML =
      '<button class="aq-map__menu reopen-btn" id="filter-button" aria-label="Open map menu" hidden>'
      + '<svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20">'
      + '<path d="M17.215,11.31L19,12.5L10,18.5L1,12.5L2.785,11.31L9.945,16.083C9.978,16.106 10.022,16.106 10.055,16.083L17.215,11.31Z" style="fill:currentColor;"></path>'
      + '<path d="M10,1.5L1,7.5L10,14.5L19,7.5L10,1.5ZM10,3.88L15.43,7.5L10,11.12L4.57,7.5L10,3.88Z" style="fill:currentColor;"></path>'
      + '</svg>'
      + '<span class="reopen-text">Menu</span>'
      + '</button>'
      + '<button class="aq-map__menu reopen-btn" id="key-button" aria-label="Toggle map key">'
      + '<svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20" fill-rule="evenodd" fill="currentColor">'
      + '<circle cx="3.5" cy="4" r="1.5"></circle>'
      + '<circle cx="3.5" cy="10" r="1.5"></circle>'
      + '<circle cx="3.5" cy="16" r="1.5"></circle>'
      + '<path d="M7 4h11M7 10h11M7 16h11" fill="none" stroke="currentColor" stroke-width="2"></path>'
      + '</svg>'
      + '<span class="reopen-text">Key</span>'
      + '</button>'
    document.getElementById('key-button').addEventListener('click', function () {
      var overlay = document.getElementById('map-key-overlay')
      if (overlay && overlay.hidden) {
        _keyClosedByUser = false
        _showKeyOverlay()
      } else {
        _hideKeyOverlay(true)
      }
    })
  }

  function _initFilterPanel() {
    var panel = document.getElementById('filter-panel')
    if (!panel) return

    panel.innerHTML =
      '<button id="filter-panel-close" class="aq-filter-panel__close" aria-label="Close filter panel">'
      + '<svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 20 20">'
      + '<path d="M10,8.6L15.6,3L17,4.4L11.4,10L17,15.6L15.6,17L10,11.4L4.4,17L3,15.6L8.6,10L3,4.4L4.4,3L10,8.6Z"/>'
      + '</svg>'
      + '<span class="govuk-visually-hidden">Close filter panel</span>'
      + '</button>'
      + '<div class="aq-filter-panel__body">'
      + '<p class="govuk-body govuk-!-font-weight-bold govuk-!-margin-bottom-0">Search by pollutant</p>'
      + '<div class="aq-filter-panel__tabs" role="group" aria-label="Pollutant category">'
      + '<button class="aq-filter-panel__tab aq-filter-panel__tab--active" id="filter-tab-daqi" aria-pressed="true"><span>DAQI pollutants</span></button>'
      + '<button class="aq-filter-panel__tab" id="filter-tab-other" aria-pressed="false"><span>Other pollutants</span></button>'
      + '</div>'
      + '<div class="aq-filter-panel__scroll"><div id="filter-mount"></div><div id="filter-sections"></div></div>'
      + '</div>'

    _renderFilterDaqi()

    var closeBtn = document.getElementById('filter-panel-close')
    var reopenBtn = document.getElementById('filter-button')
    var tabDaqi = document.getElementById('filter-tab-daqi')
    var tabOther = document.getElementById('filter-tab-other')

    closeBtn.addEventListener('click', function () {
      panel.hidden = true
      reopenBtn.hidden = false
      reopenBtn.focus()
    })

    reopenBtn.addEventListener('click', function () {
      panel.hidden = false
      reopenBtn.hidden = true
      panel.focus()
    })

    tabDaqi.addEventListener('click', function () {
      _filterState.mode = 'daqi'
      tabDaqi.setAttribute('aria-pressed', 'true')
      tabOther.setAttribute('aria-pressed', 'false')
      _renderFilterDaqi()
      if (_mapReady && _stationList) _plotAllMarkers()
    })

    tabOther.addEventListener('click', function () {
      _filterState.mode = 'other'
      tabOther.setAttribute('aria-pressed', 'true')
      tabDaqi.setAttribute('aria-pressed', 'false')
      _renderFilterOther()
      if (_mapReady && _stationList) _plotAllMarkers()
    })
  }

  function _renderFilterDaqi() {
    var mount = document.getElementById('filter-mount')
    if (!mount) return

    var items = _DAQI_POLLUTANTS.map(function (pollutant, i) {
      var id = 'filter-pollutant-' + i
      var checked = pollutant.codes.every(function (code) { return _filterState.selected.has(code) })
      return '<div class="govuk-checkboxes__item">'
        + '<input class="govuk-checkboxes__input" id="' + id + '" type="checkbox" value="' + pollutant.codes.join(',') + '"' + (checked ? ' checked' : '') + '>'
        + '<label class="govuk-label govuk-checkboxes__label" for="' + id + '">' + pollutant.label + '</label>'
        + '</div>'
    }).join('')

    mount.innerHTML = '<fieldset class="govuk-fieldset">'
      + '<legend class="govuk-visually-hidden">Select pollutants to display on the map</legend>'
      + '<div class="govuk-checkboxes govuk-checkboxes--small">' + items + '</div>'
      + '</fieldset>'

    _renderFilterSections()

    // Bind change handler once using a flag on the scroll container
    var scroll = document.querySelector('.aq-filter-panel__scroll')
    if (scroll && !scroll.dataset.filterBound) {
      scroll.addEventListener('change', function (event) {
        if (!event.target || event.target.type !== 'checkbox') return
        if (event.target.id === 'filter-show-inactive') {
          _showInactiveStations = event.target.checked
        } else {
          var codes = event.target.value.split(',')
          if (event.target.checked) {
            codes.forEach(function (code) { _filterState.selected.add(code) })
          } else {
            codes.forEach(function (code) { _filterState.selected.delete(code) })
          }
        }
        if (_mapReady && _stationList) _plotAllMarkers()
      })
      scroll.dataset.filterBound = 'true'
    }
  }

  function _renderFilterSections() {
    var sections = document.getElementById('filter-sections')
    if (!sections) return
    sections.innerHTML =
      '<details class="govuk-details govuk-!-margin-top-3 govuk-!-margin-bottom-0">'
      + '<summary class="govuk-details__summary">'
      + '<span class="govuk-details__summary-text">Data sources</span>'
      + '</summary>'
      + '<div class="govuk-details__text">'
      + '<p class="govuk-body-s govuk-!-margin-bottom-0">Automatic Urban and Rural Network (AURN)</p>'
      + '</div>'
      + '</details>'
      + '<details class="govuk-details govuk-!-margin-top-2 govuk-!-margin-bottom-0">'
      + '<summary class="govuk-details__summary">'
      + '<span class="govuk-details__summary-text">Map features</span>'
      + '</summary>'
      + '<div class="govuk-details__text">'
      + '<div class="govuk-checkboxes govuk-checkboxes--small">'
      + '<div class="govuk-checkboxes__item">'
      + '<input class="govuk-checkboxes__input" id="filter-show-inactive" type="checkbox"' + (_showInactiveStations ? ' checked' : '') + '>'
      + '<label class="govuk-label govuk-checkboxes__label" for="filter-show-inactive">Show closed and inactive stations</label>'
      + '</div>'
      + '</div>'
      + '</div>'
      + '</details>'
  }

  function _renderFilterOther() {
    var mount = document.getElementById('filter-mount')
    if (!mount) return
    mount.innerHTML = '<p class="govuk-body-s govuk-!-margin-top-2">Other pollutant networks are not yet available in this prototype.</p>'
    _renderFilterSections()
  }

  _initKeyOverlay()
  _initReopenStack()
  _initFilterPanel()
  document.getElementById('exit-map').addEventListener('click', function () {
    history.back()
  })
})()
