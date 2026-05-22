//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

const {
  checkHealth,
  getForecasts,
  getMeasurements,
  getMonitoringStations,
  getMonitoringStationInfo,
  getLocalAuthorityForCoords
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

router.get('/measurements', async (req, res) => {
  const data = await getMeasurements()
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

router.get('/api/local-authority', async (req, res) => {
  const lat = parseFloat(req.query.lat)
  const lng = parseFloat(req.query.lng)
  if (isNaN(lat) || isNaN(lng) || lat < 49 || lat > 61 || lng < -9 || lng > 2) {
    return res.status(400).json({ error: 'Invalid coordinates' })
  }
  try {
    const localAuthority = await getLocalAuthorityForCoords(lat, lng)
    res.json({ localAuthority: localAuthority || null })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})
