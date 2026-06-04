//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

const {
  checkHealth,
  getForecasts,
  getMonitoringStations,
  getMonitoringStationInfo
} = require('./api/aqieBackEnd')

// Home — landing page with View on a map link
router.get('/', async (req, res) => {
  const health = await checkHealth()
  res.render('index.html', {
    backendUrl: health.url,
    backendConnected: health.connected
  })
})

// Fullscreen map page
router.get('/map', async (req, res) => {
  const health = await checkHealth()
  res.render('map.html', {
    backendUrl: health.url,
    backendConnected: health.connected
  })
})

// JSON health endpoint polled by the client-side banner
router.get('/api/health', async (req, res) => {
  const health = await checkHealth()
  res.json(health)
})

// aqie-back-end data routes — extend these as views are built out
router.get('/forecasts', async (req, res) => {
    const data = await getForecasts()
    res.json(data)
})

router.get('/monitoringStations', async (req, res) => {
  try {
    const data = await getMonitoringStations()
    res.json(data)
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

router.get('/monitoringStationInfo', async (req, res) => {
  try {
    const data = await getMonitoringStationInfo()
    res.json(data)
  } catch (err) {
    const message = err.name === 'TimeoutError' || err.name === 'AbortError'
      ? 'Connection timeout'
      : err.message
    res.status(502).json({ error: message })
  }
})


