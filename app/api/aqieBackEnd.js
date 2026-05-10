// aqieBackEnd.js
// Thin wrapper around the aqie-back-end API.
// Provides helper functions used by routes.js to fetch air quality data
// (forecasts, measurements, monitoring station info) and check connectivity.
// The backend base URL is configured via the AQIE_BACK_END_URL environment
// variable, defaulting to http://localhost:3001 for local development.

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

async function getMonitoringStationInfo() {
  return get('/monitoringStationInfo', 120000)
}

module.exports = {
  checkHealth,
  getForecasts,
  getMeasurements,
  getMonitoringStationInfo
}
