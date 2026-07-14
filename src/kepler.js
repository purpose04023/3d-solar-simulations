/**
 * Keplerian orbital mechanics with Newton–Raphson solution of Kepler's equation.
 *
 * Positions are deterministic functions of elapsed time (and fixed orbital elements).
 * Output uses a Three.js Y-up frame: the ecliptic lies in the X/Z plane (Y ≈ 0
 * for zero inclination; inclination lifts the body in ±Y).
 */

const TWO_PI = Math.PI * 2
const DEG2RAD = Math.PI / 180

/**
 * Normalize an angle into [0, 2π).
 * @param {number} angle
 * @returns {number}
 */
export function normalizeAngle(angle) {
  const a = angle % TWO_PI
  return a < 0 ? a + TWO_PI : a
}

/**
 * Solve Kepler's equation M = E − e·sin(E) for the eccentric anomaly E
 * using Newton–Raphson iteration.
 *
 * @param {number} M  Mean anomaly (radians)
 * @param {number} e  Eccentricity [0, 1)
 * @param {number} [tolerance=1e-12]
 * @param {number} [maxIterations=20]
 * @returns {number} Eccentric anomaly E (radians)
 */
export function solveKepler(M, e, tolerance = 1e-12, maxIterations = 20) {
  M = normalizeAngle(M)

  // Initial guess: for high eccentricity start near π
  let E = e < 0.8 ? M : Math.PI

  for (let i = 0; i < maxIterations; i++) {
    const f = E - e * Math.sin(E) - M
    const fPrime = 1 - e * Math.cos(E)
    const delta = f / fPrime
    E -= delta
    if (Math.abs(delta) < tolerance) break
  }

  return E
}

/**
 * True anomaly ν from eccentric anomaly E and eccentricity e.
 * @param {number} E
 * @param {number} e
 * @returns {number}
 */
export function trueAnomaly(E, e) {
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  const cosNu = (cosE - e) / (1 - e * cosE)
  const sinNu = (Math.sqrt(1 - e * e) * sinE) / (1 - e * cosE)
  return Math.atan2(sinNu, cosNu)
}

/**
 * Heliocentric position from classical orbital elements at time t.
 *
 * Classical 3-1-3 Euler (Ω, i, ω) is evaluated, then mapped into Three.js
 * Y-up space so the reference plane is horizontal X/Z:
 *   x = in-plane (from Ω / ω / ν)
 *   y = out-of-plane (inclination) — 0 when i = 0
 *   z = in-plane orthogonal axis
 *
 * @param {object} elements
 * @param {number} elements.a   Semi-major axis (scene units)
 * @param {number} elements.e   Eccentricity
 * @param {number} elements.i   Inclination (radians)
 * @param {number} elements.Omega Longitude of ascending node Ω (radians)
 * @param {number} elements.omega Argument of periapsis ω (radians)
 * @param {number} elements.M0  Mean anomaly at epoch t=0 (radians)
 * @param {number} elements.n   Mean motion (radians per unit of t)
 * @param {number} t            Elapsed time in the same units as period used for n
 * @returns {{ x: number, y: number, z: number, E: number, nu: number, r: number }}
 */
export function orbitalPosition(elements, t) {
  const { a, e, i, Omega, omega, M0, n } = elements

  // Mean anomaly advances linearly with time
  const M = normalizeAngle(M0 + n * t)

  // Eccentric anomaly via Newton iteration
  const E = solveKepler(M, e)

  // Radial distance
  const r = a * (1 - e * Math.cos(E))

  // True anomaly
  const nu = trueAnomaly(E, e)

  // Argument of latitude
  const u = omega + nu

  const cosO = Math.cos(Omega)
  const sinO = Math.sin(Omega)
  const cosI = Math.cos(i)
  const sinI = Math.sin(i)
  const cosU = Math.cos(u)
  const sinU = Math.sin(u)

  // Classical ecliptic (X/Y plane, Z out) → Three.js Y-up (X/Z plane, Y up)
  const xEcl = r * (cosO * cosU - sinO * sinU * cosI)
  const yEcl = r * (sinO * cosU + cosO * sinU * cosI)
  const zEcl = r * (sinU * sinI)

  const x = xEcl
  const y = zEcl // vertical; ~0 for i ≈ 0
  const z = yEcl // second horizontal axis

  return { x, y, z, E, nu, r }
}

/**
 * Sample points along a full Keplerian orbit (for drawing trajectory rings).
 * Same X/Z horizontal frame as orbitalPosition.
 *
 * @param {object} elements  Same shape as orbitalPosition (n, M0 unused)
 * @param {number} [segments=128]
 * @returns {Float32Array} Flat xyz triplets, length segments * 3
 */
export function sampleOrbit(elements, segments = 128) {
  const points = new Float32Array(segments * 3)
  const { a, e, i, Omega, omega } = elements

  for (let k = 0; k < segments; k++) {
    // Uniform in mean anomaly → correct elliptical shape via Kepler
    const M = (TWO_PI * k) / segments
    const E = solveKepler(M, e)
    const r = a * (1 - e * Math.cos(E))
    const nu = trueAnomaly(E, e)
    const u = omega + nu

    const cosO = Math.cos(Omega)
    const sinO = Math.sin(Omega)
    const cosI = Math.cos(i)
    const sinI = Math.sin(i)
    const cosU = Math.cos(u)
    const sinU = Math.sin(u)

    const xEcl = r * (cosO * cosU - sinO * sinU * cosI)
    const yEcl = r * (sinO * cosU + cosO * sinU * cosI)
    const zEcl = r * (sinU * sinI)

    points[k * 3] = xEcl
    points[k * 3 + 1] = zEcl
    points[k * 3 + 2] = yEcl
  }

  return points
}

/**
 * Convert degrees to radians.
 * @param {number} deg
 * @returns {number}
 */
export function deg(deg) {
  return deg * DEG2RAD
}

/**
 * Mean motion from orbital period.
 * @param {number} period  Period in the same time unit used for t
 * @returns {number} radians per unit time
 */
export function meanMotion(period) {
  return TWO_PI / period
}
