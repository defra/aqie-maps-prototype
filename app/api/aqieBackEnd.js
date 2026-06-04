// aqieBackEnd.js
// Thin wrapper around the aqie-back-end and aqie-forecast-api APIs.
// Provides helper functions used by routes.js to fetch air quality data
// (forecasts, measurements, monitoring station info) and check connectivity.
// The backend base URL is configured via the AQIE_BACK_END_URL environment
// variable, defaulting to http://localhost:3001 for local development.
// Forecast data is fetched from AQIE_FORECAST_API_URL

const backendUrl = process.env.AQIE_BACK_END_URL || 'http://localhost:3001'
const forecastApiUrl = process.env.AQIE_FORECAST_API_URL

async function get(baseUrl, path, timeoutMs = 5000) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!response.ok) {
    throw new Error(`${baseUrl} responded ${response.status} for ${path}`)
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
  return get(forecastApiUrl, '/forecast')
}

async function getMeasurements() {
  return get(backendUrl, '/measurements')
}

async function getMonitoringStations() {
  return get(backendUrl, '/monitoringStations')
}

async function getMonitoringStationInfo() {
  return get(backendUrl, '/monitoringStationInfo', 120000)
}

module.exports = {
  checkHealth,
  getForecasts,
  getMeasurements,
  getMonitoringStations,
  getMonitoringStationInfo
}
