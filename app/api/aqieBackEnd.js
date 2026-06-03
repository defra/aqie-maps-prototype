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

async function checkEndpoints() {
  const endpoints = [
    { name: 'forecasts', path: '/forecasts' },
    { name: 'measurements', path: '/measurements' },
    { name: 'monitoringStations', path: '/monitoringStations' },
    { name: 'monitoringStationInfo', path: '/monitoringStationInfo' }
  ]

  const results = await Promise.all(
    endpoints.map(async ({ name, path }) => {
      try {
        const response = await fetch(`${backendUrl}${path}`, {
          signal: AbortSignal.timeout(5000)
        })
        if (!response.ok) {
          return { name, ok: false, error: `HTTP ${response.status}` }
        }
        const data = await response.json()
        const count = Array.isArray(data) ? data.length : Array.isArray(data?.stations) ? data.stations.length : null
        return { name, ok: true, count }
      } catch (err) {
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
        return { name, ok: false, error: isTimeout ? 'Timeout' : err.message }
      }
    })
  )

  return results
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

module.exports = {
  checkHealth,
  checkEndpoints,
  getForecasts,
  getMeasurements,
  getMonitoringStations,
  getMonitoringStationInfo
}
