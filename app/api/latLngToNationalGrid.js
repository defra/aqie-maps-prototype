// latLngToNationalGrid.js
// Pure-maths conversion from WGS84 lat/lng to British National Grid (OSGB36) easting/northing.
// Algorithm published by Ordnance Survey:
// "A guide to coordinate systems in Great Britain" (document C)
// https://www.ordnancesurvey.co.uk/documents/resources/guide-coordinate-systems-great-britain.pdf
// No external dependencies.

function latLngToNationalGrid(lat, lng) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180

  // ── Step 1: WGS84 lat/lng → WGS84 Cartesian (X, Y, Z) ──────────────────
  const wgs84SemiMajorAxis = 6378137.0       // metres
  const wgs84SemiMinorAxis = 6356752.3141    // metres
  const wgs84EccentricitySquared = 1 - (wgs84SemiMinorAxis * wgs84SemiMinorAxis) / (wgs84SemiMajorAxis * wgs84SemiMajorAxis)

  const latRadians = toRadians(lat)
  const lngRadians = toRadians(lng)
  const sinLatitude = Math.sin(latRadians)
  const cosLatitude = Math.cos(latRadians)
  const primeVerticalRadius = wgs84SemiMajorAxis / Math.sqrt(1 - wgs84EccentricitySquared * sinLatitude * sinLatitude)

  const cartesianX = primeVerticalRadius * cosLatitude * Math.cos(lngRadians)
  const cartesianY = primeVerticalRadius * cosLatitude * Math.sin(lngRadians)
  const cartesianZ = primeVerticalRadius * (1 - wgs84EccentricitySquared) * sinLatitude

  // ── Step 2: Helmert 7-parameter transformation WGS84 → OSGB36 ───────────
  // Parameters from OS document, Table 1
  const translationX = -446.448  // metres
  const translationY =  125.157
  const translationZ = -542.060
  const rotationX = toRadians(-0.1502 / 3600)  // arcseconds converted to radians
  const rotationY = toRadians(-0.2470 / 3600)
  const rotationZ = toRadians(-0.8421 / 3600)
  const scaleFactor = 1 + 20.4894e-6

  const osgb36CartesianX = translationX + scaleFactor * (cartesianX - rotationZ * cartesianY + rotationY * cartesianZ)
  const osgb36CartesianY = translationY + scaleFactor * (rotationZ * cartesianX + cartesianY - rotationX * cartesianZ)
  const osgb36CartesianZ = translationZ + scaleFactor * (-rotationY * cartesianX + rotationX * cartesianY + cartesianZ)

  // ── Step 3: OSGB36 Cartesian → OSGB36 lat/lng (iterative) ───────────────
  const osgb36SemiMajorAxis = 6377563.396    // metres
  const osgb36SemiMinorAxis = 6356256.909    // metres
  const osgb36EccentricitySquared = 1 - (osgb36SemiMinorAxis * osgb36SemiMinorAxis) / (osgb36SemiMajorAxis * osgb36SemiMajorAxis)

  const horizontalDistance = Math.sqrt(osgb36CartesianX * osgb36CartesianX + osgb36CartesianY * osgb36CartesianY)
  let osgb36LatRadians = Math.atan2(osgb36CartesianZ, horizontalDistance * (1 - osgb36EccentricitySquared))
  for (let iteration = 0; iteration < 10; iteration++) {
    const iterativePrimeVerticalRadius = osgb36SemiMajorAxis / Math.sqrt(1 - osgb36EccentricitySquared * Math.sin(osgb36LatRadians) * Math.sin(osgb36LatRadians))
    osgb36LatRadians = Math.atan2(osgb36CartesianZ + osgb36EccentricitySquared * iterativePrimeVerticalRadius * Math.sin(osgb36LatRadians), horizontalDistance)
  }
  const osgb36LngRadians = Math.atan2(osgb36CartesianY, osgb36CartesianX)

  // ── Step 4: OSGB36 lat/lng → BNG Transverse Mercator easting/northing ───
  // Projection constants for the National Grid
  const centralMeridianScaleFactor = 0.9996012717
  const trueOriginLatRadians = toRadians(49)   // 49° N
  const trueOriginLngRadians = toRadians(-2)   // 2° W
  const falseEasting  =  400000  // metres
  const falseNorthing = -100000  // metres

  const thirdFlattening        = (osgb36SemiMajorAxis - osgb36SemiMinorAxis) / (osgb36SemiMajorAxis + osgb36SemiMinorAxis)
  const thirdFlatteningSquared = thirdFlattening * thirdFlattening
  const thirdFlatteningCubed   = thirdFlattening * thirdFlattening * thirdFlattening

  const sinLat = Math.sin(osgb36LatRadians)
  const cosLat = Math.cos(osgb36LatRadians)
  const tanLat = Math.tan(osgb36LatRadians)

  const meridionalRadius  = osgb36SemiMajorAxis * centralMeridianScaleFactor * (1 - osgb36EccentricitySquared) / Math.pow(1 - osgb36EccentricitySquared * sinLat * sinLat, 1.5)
  const transverseRadius  = osgb36SemiMajorAxis * centralMeridianScaleFactor / Math.sqrt(1 - osgb36EccentricitySquared * sinLat * sinLat)
  const secondEccentricitySquared = transverseRadius / meridionalRadius - 1

  // Meridian arc length from true origin to point latitude
  const arcTermA = (1 + thirdFlattening + 5 / 4 * thirdFlatteningSquared + 5 / 4 * thirdFlatteningCubed) * (osgb36LatRadians - trueOriginLatRadians)
  const arcTermB = (3 * thirdFlattening + 3 * thirdFlatteningSquared + 21 / 8 * thirdFlatteningCubed) * Math.sin(osgb36LatRadians - trueOriginLatRadians) * Math.cos(osgb36LatRadians + trueOriginLatRadians)
  const arcTermC = (15 / 8 * thirdFlatteningSquared + 15 / 8 * thirdFlatteningCubed) * Math.sin(2 * (osgb36LatRadians - trueOriginLatRadians)) * Math.cos(2 * (osgb36LatRadians + trueOriginLatRadians))
  const arcTermD = 35 / 24 * thirdFlatteningCubed * Math.sin(3 * (osgb36LatRadians - trueOriginLatRadians)) * Math.cos(3 * (osgb36LatRadians + trueOriginLatRadians))
  const meridianArcLength = osgb36SemiMinorAxis * centralMeridianScaleFactor * (arcTermA - arcTermB + arcTermC - arcTermD)

  // Polynomial expansion coefficients for northing and easting (OS notation: I–VI)
  const longitudeDelta = osgb36LngRadians - trueOriginLngRadians
  const northingCoeff1 = meridianArcLength + falseNorthing
  const northingCoeff2 = transverseRadius / 2 * sinLat * cosLat
  const northingCoeff3 = transverseRadius / 24 * sinLat * Math.pow(cosLat, 3) * (5 - tanLat * tanLat + 9 * secondEccentricitySquared)
  const northingCoeff4 = transverseRadius / 720 * sinLat * Math.pow(cosLat, 5) * (61 - 58 * tanLat * tanLat + Math.pow(tanLat, 4))
  const eastingCoeff1  = transverseRadius * cosLat
  const eastingCoeff2  = transverseRadius / 6 * Math.pow(cosLat, 3) * (transverseRadius / meridionalRadius - tanLat * tanLat)
  const eastingCoeff3  = transverseRadius / 120 * Math.pow(cosLat, 5) * (5 - 18 * tanLat * tanLat + Math.pow(tanLat, 4) + 14 * secondEccentricitySquared - 58 * tanLat * tanLat * secondEccentricitySquared)

  const easting  = Math.round((falseEasting  + eastingCoeff1 * longitudeDelta + eastingCoeff2 * Math.pow(longitudeDelta, 3) + eastingCoeff3 * Math.pow(longitudeDelta, 5)) * 100) / 100
  const northing = Math.round((northingCoeff1 + northingCoeff2 * longitudeDelta * longitudeDelta + northingCoeff3 * Math.pow(longitudeDelta, 4) + northingCoeff4 * Math.pow(longitudeDelta, 6)) * 100) / 100

  return { easting, northing }
}

module.exports = { latLngToNationalGrid }
