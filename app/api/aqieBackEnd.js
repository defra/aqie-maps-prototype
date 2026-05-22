// aqieBackEnd.js
// Thin wrapper around the aqie-back-end API.
// Provides helper functions used by routes.js to fetch air quality data
// (forecasts, measurements, monitoring station info) and check connectivity.
// The backend base URL is configured via the AQIE_BACK_END_URL environment
// variable, defaulting to http://localhost:3001 for local development.

const { latLngToNationalGrid } = require('./latLngToNationalGrid')

const backendUrl = process.env.AQIE_BACK_END_URL || 'http://localhost:3001'

async function get(path, timeoutMs = 5000) {
  const response = await fetch(`${backendUrl}${path}`, {
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok) {
    throw new Error(`aqie-back-end responded ${response.status} for ${path}`)
  }
  return response.json()
}

async function checkHealth() {
  try {
    const response = await fetch(`${backendUrl}/health`, {
      signal: AbortSignal.timeout(3000)
    })
    return { connected: response.ok, url: backendUrl }
  } catch {
    return { connected: false, url: backendUrl }
  }
}

async function getForecasts() {
  return get('/forecasts')
}

async function getMeasurements() {
  return get('/measurements')
}

async function getMonitoringStations() {
  return get('/monitoringStations')
}

async function getMonitoringStationInfo() {
  return get('/monitoringStationInfo', 120000)
}

const OS_NAMES_BASE_URL = process.env.OS_NAMES_API_URL || 'https://api.os.uk/search/names/v1/'
const OS_NAMES_API_KEY = process.env.OS_NAMES_API_KEY || ''

async function getLocalAuthorityForCoords(lat, lng) {
  if (!OS_NAMES_API_KEY) return null

  // OS Names /nearest requires British National Grid (easting, northing), not WGS84.
  // Convert using the published OS Helmert transformation — no external dependencies.
  const { easting, northing } = latLngToNationalGrid(lat, lng)

  const url = `${OS_NAMES_BASE_URL}nearest?point=${easting},${northing}&key=${OS_NAMES_API_KEY}`

  const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) return null

  const data = await response.json()
  const entry = data?.results?.[0]?.GAZETTEER_ENTRY
  if (!entry) return null

  // Nearest result is typically a postcode — its COUNTY_UNITARY / DISTRICT_BOROUGH
  // fields identify the local authority.
  return entry.COUNTY_UNITARY || entry.DISTRICT_BOROUGH || null
}

module.exports = {
  checkHealth,
  getForecasts,
  getMeasurements,
  getMonitoringStations,
  getMonitoringStationInfo,
  getLocalAuthorityForCoords
}
