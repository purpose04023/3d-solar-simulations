import * as THREE from 'three'
import { deg, meanMotion, orbitalPosition, sampleOrbit } from './kepler.js'

/**
 * Visualization scale: 1 scene unit ≈ 1 AU at Earth's orbit.
 * Outer planets use real semi-major axes so the system is huge —
 * the camera starts near the inner system.
 */

/** Sidereal year in Earth days → used as base time unit for periods */
const DAY = 1 // one "day" of simulation time base
const YEAR = 365.25 * DAY

/**
 * Classical orbital elements (approximate J2000-like values).
 * Periods expressed in simulation days; n computed in rad / sim-second
 * where 1 sim-second of wall time at 1× speed = TIME_SCALE days.
 *
 * timeScale (days of solar time per real second) is applied in main.js.
 */
export const PLANETS = [
  {
    name: 'Mercury',
    color: 0xb5b5b5,
    radius: 0.038,
    a: 0.387,
    e: 0.2056,
    i: deg(7.005),
    Omega: deg(48.331),
    omega: deg(29.124),
    M0: deg(174.796),
    periodDays: 87.969,
  },
  {
    name: 'Venus',
    color: 0xe8cda0,
    radius: 0.095,
    a: 0.723,
    e: 0.0068,
    i: deg(3.395),
    Omega: deg(76.68),
    omega: deg(54.884),
    M0: deg(50.115),
    periodDays: 224.701,
  },
  {
    name: 'Earth',
    color: 0x4a90d9,
    radius: 0.1,
    a: 1.0,
    e: 0.0167,
    i: deg(0.0),
    Omega: deg(-11.261),
    omega: deg(114.208),
    M0: deg(358.617),
    periodDays: 365.256,
  },
  {
    name: 'Mars',
    color: 0xc1440e,
    radius: 0.053,
    a: 1.524,
    e: 0.0934,
    i: deg(1.85),
    Omega: deg(49.558),
    omega: deg(286.502),
    M0: deg(19.373),
    periodDays: 686.98,
  },
  {
    name: 'Jupiter',
    color: 0xd4a574,
    radius: 0.28,
    a: 5.203,
    e: 0.0489,
    i: deg(1.303),
    Omega: deg(100.464),
    omega: deg(273.867),
    M0: deg(20.02),
    periodDays: 4332.59,
  },
  {
    name: 'Saturn',
    color: 0xe8d5a3,
    radius: 0.24,
    a: 9.537,
    e: 0.0565,
    i: deg(2.485),
    Omega: deg(113.665),
    omega: deg(339.392),
    M0: deg(317.02),
    periodDays: 10759.22,
    rings: { inner: 0.32, outer: 0.52, color: 0xc9b896, opacity: 0.55 },
  },
  {
    name: 'Uranus',
    color: 0x7ec8e3,
    radius: 0.16,
    a: 19.191,
    e: 0.0457,
    i: deg(0.773),
    Omega: deg(74.006),
    omega: deg(96.998),
    M0: deg(142.24),
    periodDays: 30688.5,
  },
  {
    name: 'Neptune',
    color: 0x4169e1,
    radius: 0.15,
    a: 30.07,
    e: 0.0113,
    i: deg(1.77),
    Omega: deg(131.784),
    omega: deg(276.336),
    M0: deg(256.23),
    periodDays: 60182,
  },
]

/**
 * Build Keplerian elements with mean motion in rad per simulation-day.
 * main multiplies wall-clock seconds by timeScale (days/sec) then passes
 * that as t into orbitalPosition.
 */
export function toElements(planet) {
  return {
    a: planet.a,
    e: planet.e,
    i: planet.i,
    Omega: planet.Omega,
    omega: planet.omega,
    M0: planet.M0,
    n: meanMotion(planet.periodDays),
  }
}

/**
 * Create a sun mesh + light group.
 * @returns {{ group: THREE.Group, light: THREE.PointLight }}
 */
export function createSun() {
  const group = new THREE.Group()
  group.name = 'Sun'

  const geometry = new THREE.SphereGeometry(0.35, 48, 48)
  const material = new THREE.MeshBasicMaterial({ color: 0xffdd66 })
  const mesh = new THREE.Mesh(geometry, material)
  group.add(mesh)

  // Soft glow shell
  const glowGeom = new THREE.SphereGeometry(0.48, 32, 32)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  })
  group.add(new THREE.Mesh(glowGeom, glowMat))

  const light = new THREE.PointLight(0xfff2cc, 2.5, 120, 0.6)
  light.castShadow = false
  group.add(light)

  return { group, light }
}

/**
 * Build planet mesh, optional rings, and orbit line.
 * @param {typeof PLANETS[number]} planet
 * @returns {{ mesh: THREE.Mesh, orbitLine: THREE.Line, elements: object, name: string }}
 */
export function createPlanet(planet) {
  const elements = toElements(planet)

  const geometry = new THREE.SphereGeometry(planet.radius, 32, 32)
  const material = new THREE.MeshStandardMaterial({
    color: planet.color,
    roughness: 0.75,
    metalness: 0.05,
    emissive: planet.color,
    emissiveIntensity: 0.06,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = planet.name

  if (planet.rings) {
    const ringGeom = new THREE.RingGeometry(
      planet.rings.inner,
      planet.rings.outer,
      64,
    )
    // RingGeometry lies in XY; tilt so rings face roughly ecliptic-edge on
    const pos = ringGeom.attributes.position
    const uv = ringGeom.attributes.uv
    for (let i = 0; i < pos.count; i++) {
      // Flip normals for double-sided look via material
      void uv
    }
    const ringMat = new THREE.MeshBasicMaterial({
      color: planet.rings.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: planet.rings.opacity,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeom, ringMat)
    ring.rotation.x = Math.PI / 2
    mesh.add(ring)
  }

  // Orbit path from Kepler sampling (closed loop)
  const segments = 256
  const flat = sampleOrbit(elements, segments)
  const orbitGeom = new THREE.BufferGeometry()
  const positions = new Float32Array((segments + 1) * 3)
  positions.set(flat)
  // Close the loop
  positions[segments * 3] = flat[0]
  positions[segments * 3 + 1] = flat[1]
  positions[segments * 3 + 2] = flat[2]
  orbitGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const orbitMat = new THREE.LineBasicMaterial({
    color: planet.color,
    transparent: true,
    opacity: 0.28,
  })
  const orbitLine = new THREE.Line(orbitGeom, orbitMat)
  orbitLine.name = `${planet.name}-orbit`

  return { mesh, orbitLine, elements, name: planet.name, radius: planet.radius }
}

/**
 * Update planet mesh position from elapsed simulation time (in days).
 * @param {{ mesh: THREE.Mesh, elements: object }} body
 * @param {number} tDays
 */
export function updatePlanetPosition(body, tDays) {
  const { x, y, z } = orbitalPosition(body.elements, tDays)
  // Three.js Y-up: map ecliptic (x, y plane) → (x, z) horizontal, y vertical
  body.mesh.position.set(x, z, y)
}

/**
 * Sparse starfield background.
 * @param {number} [count=2500]
 * @returns {THREE.Points}
 */
export function createStarfield(count = 2500) {
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    // Uniform on a large sphere shell
    const r = 80 + Math.random() * 120
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.35,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  })
  return new THREE.Points(geom, mat)
}

export { YEAR, DAY }
