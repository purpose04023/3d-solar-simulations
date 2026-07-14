import * as THREE from 'three'
import { deg, meanMotion, orbitalPosition, sampleOrbit } from './kepler.js'

/**
 * Display distance scale: compress large AU so the whole system fits on screen
 * while keeping relative Keplerian ellipse shapes. n still uses real periodDays.
 */
export function toDisplayA(aAU) {
  // √-style compress: Earth ~2.5, Jupiter ~6.5, Neptune ~14
  return Math.pow(aAU, 0.52) * 2.5
}

/**
 * Build a procedural equirectangular planet map as a data-URL.
 * TextureLoader can load these; swap textureURL to a local file later:
 *   new URL('./assets/textures/earth.jpg', import.meta.url).href
 *
 * @param {number} baseHex  Planet’s true visual color
 * @param {'rocky'|'earth'|'banded'|'ice'} style
 * @returns {string} data:image/png;base64,...
 */
export function createPlanetTextureURL(baseHex, style = 'rocky') {
  const w = 512
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')

  const base = new THREE.Color(baseHex)
  const css = `#${base.getHexString()}`

  // Base fill
  ctx.fillStyle = css
  ctx.fillRect(0, 0, w, h)

  if (style === 'banded') {
    // Gas-giant latitudinal bands
    for (let y = 0; y < h; y++) {
      const t = y / h
      const band = Math.sin(t * Math.PI * 14 + Math.sin(t * 9) * 1.4)
      const shade = 0.72 + band * 0.22
      const c = base.clone().multiplyScalar(shade)
      // Warm / cool alternate tint
      if (band > 0.15) c.offsetHSL(0.02, 0.05, 0.04)
      else c.offsetHSL(-0.03, -0.04, -0.05)
      ctx.fillStyle = `#${c.getHexString()}`
      ctx.fillRect(0, y, w, 1)
    }
    // Soft storms
    for (let i = 0; i < 6; i++) {
      const cx = Math.random() * w
      const cy = h * (0.25 + Math.random() * 0.5)
      const rx = 18 + Math.random() * 40
      const ry = 8 + Math.random() * 14
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx)
      const storm = base.clone().offsetHSL(0.05, 0.1, 0.12)
      g.addColorStop(0, `rgba(${toRGB(storm)},0.55)`)
      g.addColorStop(1, `rgba(${toRGB(storm)},0)`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (style === 'ice') {
    // Smooth ice giant with subtle aqua bands
    for (let y = 0; y < h; y++) {
      const t = y / h
      const band = Math.sin(t * Math.PI * 6) * 0.08
      const c = base.clone().offsetHSL(0, 0.05, band)
      ctx.fillStyle = `#${c.getHexString()}`
      ctx.fillRect(0, y, w, 1)
    }
    // Polar brightening
    const polar = ctx.createLinearGradient(0, 0, 0, h)
    polar.addColorStop(0, 'rgba(255,255,255,0.22)')
    polar.addColorStop(0.2, 'rgba(255,255,255,0)')
    polar.addColorStop(0.8, 'rgba(255,255,255,0)')
    polar.addColorStop(1, 'rgba(255,255,255,0.22)')
    ctx.fillStyle = polar
    ctx.fillRect(0, 0, w, h)
  } else {
    // Rocky (and Earth): mottled surface
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 1 + Math.random() * 4
      const c = base.clone().offsetHSL(
        (Math.random() - 0.5) * 0.04,
        (Math.random() - 0.5) * 0.12,
        (Math.random() - 0.5) * 0.18,
      )
      ctx.fillStyle = `rgba(${toRGB(c)},${0.15 + Math.random() * 0.35})`
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    if (style === 'earth') {
      ctx.fillStyle = 'rgba(46, 125, 50, 0.5)'
      for (let i = 0; i < 48; i++) {
        blob(ctx, Math.random() * w, Math.random() * h, 8 + Math.random() * 28)
      }
      ctx.fillStyle = 'rgba(194, 168, 120, 0.32)'
      for (let i = 0; i < 20; i++) {
        blob(ctx, Math.random() * w, Math.random() * h, 6 + Math.random() * 16)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.2)'
      for (let i = 0; i < 28; i++) {
        const y = Math.random() * h
        ctx.fillRect(0, y, w, 1 + Math.random() * 3)
      }
    }
  }

  // Soft equatorial sheen
  const sheen = ctx.createLinearGradient(0, 0, 0, h)
  sheen.addColorStop(0, 'rgba(0,0,0,0.18)')
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  sheen.addColorStop(1, 'rgba(0,0,0,0.22)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, 0, w, h)

  return canvas.toDataURL('image/png')
}

function toRGB(color) {
  return `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`
}

function blob(ctx, x, y, r) {
  ctx.beginPath()
  ctx.ellipse(x, y, r, r * (0.5 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * Classic visual colors + sized for readability (not true scale).
 * textureURL is generated from color so each planet looks correct offline.
 * Replace textureURL with real map paths when you have local assets.
 */
export const PLANETS = [
  {
    name: 'Mercury',
    color: 0x9a9590,
    style: 'rocky',
    radius: 0.14,
    aAU: 0.387,
    e: 0.2056,
    i: deg(7.005),
    Omega: deg(48.331),
    omega: deg(29.124),
    M0: deg(174.796),
    periodDays: 87.969,
  },
  {
    name: 'Venus',
    color: 0xe8d5a3,
    style: 'rocky',
    radius: 0.2,
    aAU: 0.723,
    e: 0.0068,
    i: deg(3.395),
    Omega: deg(76.68),
    omega: deg(54.884),
    M0: deg(50.115),
    periodDays: 224.701,
  },
  {
    name: 'Earth',
    color: 0x2f6fed,
    style: 'earth',
    radius: 0.22,
    aAU: 1.0,
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
    style: 'rocky',
    radius: 0.17,
    aAU: 1.524,
    e: 0.0934,
    i: deg(1.85),
    Omega: deg(49.558),
    omega: deg(286.502),
    M0: deg(19.373),
    periodDays: 686.98,
  },
  {
    name: 'Jupiter',
    color: 0xd4a06a,
    style: 'banded',
    radius: 0.55,
    aAU: 5.203,
    e: 0.0489,
    i: deg(1.303),
    Omega: deg(100.464),
    omega: deg(273.867),
    M0: deg(20.02),
    periodDays: 4332.59,
  },
  {
    name: 'Saturn',
    color: 0xe8d9a0,
    style: 'banded',
    radius: 0.48,
    aAU: 9.537,
    e: 0.0565,
    i: deg(2.485),
    Omega: deg(113.665),
    omega: deg(339.392),
    M0: deg(317.02),
    periodDays: 10759.22,
    rings: { inner: 0.62, outer: 1.05, color: 0xd4c49a, opacity: 0.7 },
  },
  {
    name: 'Uranus',
    color: 0x7fdbda,
    style: 'ice',
    radius: 0.36,
    aAU: 19.191,
    e: 0.0457,
    i: deg(0.773),
    Omega: deg(74.006),
    omega: deg(96.998),
    M0: deg(142.24),
    periodDays: 30688.5,
  },
  {
    name: 'Neptune',
    color: 0x3f5bdb,
    style: 'ice',
    radius: 0.35,
    aAU: 30.07,
    e: 0.0113,
    i: deg(1.77),
    Omega: deg(131.784),
    omega: deg(276.336),
    M0: deg(256.23),
    periodDays: 60182,
  },
]

// Attach display semi-major axis + generated textureURL once (DOM available)
for (const p of PLANETS) {
  p.a = toDisplayA(p.aAU)
  p.textureURL = createPlanetTextureURL(p.color, p.style)
}

/** Shared loader so textures share cache; works with data URLs and remote/local paths */
const textureLoader = new THREE.TextureLoader()

/**
 * Build Keplerian elements with mean motion in rad per simulation-day.
 * `a` is the display-scaled semi-major axis (shape preserved).
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
 * Load map from textureURL; always tint with the planet’s true color as fallback.
 * @param {string} textureURL
 * @param {number} planetColor
 * @param {THREE.MeshStandardMaterial} material
 */
function applyPlanetTexture(textureURL, planetColor, material) {
  // Correct color immediately so the body never flashes wrong/gray
  material.color.setHex(planetColor)

  if (!textureURL) return

  textureLoader.load(
    textureURL,
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = 8
      material.map = texture
      // Map already carries the planet color — keep multiply at white
      material.color.setHex(0xffffff)
      material.needsUpdate = true
    },
    undefined,
    () => {
      material.map = null
      material.color.setHex(planetColor)
      material.needsUpdate = true
    },
  )
}

/**
 * Create a sun mesh + light group (bright enough to light outer planets).
 * @returns {{ group: THREE.Group, light: THREE.PointLight }}
 */
export function createSun() {
  const group = new THREE.Group()
  group.name = 'Sun'

  const geometry = new THREE.SphereGeometry(0.45, 48, 48)
  const material = new THREE.MeshBasicMaterial({ color: 0xffe066 })
  group.add(new THREE.Mesh(geometry, material))

  const glowGeom = new THREE.SphereGeometry(0.65, 32, 32)
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffaa33,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  })
  group.add(new THREE.Mesh(glowGeom, glowMat))

  // Long range so Uranus / Neptune still receive light
  const light = new THREE.PointLight(0xfff2cc, 4.5, 80, 0.35)
  group.add(light)

  return { group, light }
}

/**
 * Build planet mesh from textureURL, optional rings, and orbit line.
 *
 * @param {typeof PLANETS[number]} planet
 * @param {string} [textureURL=planet.textureURL]
 * @returns {{ mesh: THREE.Mesh, orbitLine: THREE.Line, elements: object, name: string, color: number }}
 */
export function createPlanet(planet, textureURL = planet.textureURL) {
  const { color = 0x888888, radius, name, rings } = planet
  const elements = toElements(planet)

  const geometry = new THREE.SphereGeometry(radius, 48, 48)
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0.05,
    // Soft self-glow so bodies read against black space on the night side
    emissive: color,
    emissiveIntensity: 0.12,
  })

  applyPlanetTexture(textureURL, color, material)

  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  // Ensure frustum culling doesn’t drop distant bodies unexpectedly
  mesh.frustumCulled = true

  if (rings) {
    const ringGeom = new THREE.RingGeometry(rings.inner, rings.outer, 96)
    const ringMat = new THREE.MeshBasicMaterial({
      color: rings.color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: rings.opacity,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeom, ringMat)
    ring.rotation.x = -Math.PI / 2
    mesh.add(ring)
  }

  const segments = 256
  const flat = sampleOrbit(elements, segments)
  const orbitGeom = new THREE.BufferGeometry()
  const positions = new Float32Array((segments + 1) * 3)
  positions.set(flat)
  positions[segments * 3] = flat[0]
  positions[segments * 3 + 1] = flat[1]
  positions[segments * 3 + 2] = flat[2]
  orbitGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const orbitMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.35,
  })
  const orbitLine = new THREE.Line(orbitGeom, orbitMat)
  orbitLine.name = `${name}-orbit`

  return { mesh, orbitLine, elements, name, radius, color }
}

/**
 * Update planet mesh position from elapsed simulation time (in days).
 * @param {{ mesh: THREE.Mesh, elements: object }} body
 * @param {number} tDays
 */
export function updatePlanetPosition(body, tDays) {
  const { x, y, z } = orbitalPosition(body.elements, tDays)
  body.mesh.position.set(x, y, z)
}

/**
 * Massive multi-layer starfield / distant galaxy particle system.
 * @param {object} [options]
 * @param {number} [options.count=18000]
 * @returns {THREE.Group}
 */
export function createStarfield({ count = 18000 } = {}) {
  const group = new THREE.Group()
  group.name = 'Starfield'

  const layers = [
    { share: 0.55, rMin: 90, rMax: 220, size: 0.28, color: 0xe8f0ff, opacity: 0.9 },
    { share: 0.3, rMin: 140, rMax: 320, size: 0.55, color: 0xc8d8ff, opacity: 0.75 },
    { share: 0.15, rMin: 200, rMax: 420, size: 1.1, color: 0xffe8c8, opacity: 0.55 },
  ]

  for (const layer of layers) {
    const n = Math.floor(count * layer.share)
    const positions = new Float32Array(n * 3)
    const colors = new Float32Array(n * 3)
    const base = new THREE.Color(layer.color)

    for (let i = 0; i < n; i++) {
      const r = layer.rMin + Math.random() * (layer.rMax - layer.rMin)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      const c = base.clone()
      c.offsetHSL(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.15,
        (Math.random() - 0.5) * 0.25,
      )
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    group.add(
      new THREE.Points(
        geom,
        new THREE.PointsMaterial({
          size: layer.size,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: true,
          opacity: layer.opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      ),
    )
  }

  const dustCount = 4000
  const dustPos = new Float32Array(dustCount * 3)
  const dustCol = new Float32Array(dustCount * 3)
  const dustColor = new THREE.Color(0x8899cc)
  for (let i = 0; i < dustCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 180 + (Math.random() - 0.5) * 100
    const height = (Math.random() - 0.5) * 40
    dustPos[i * 3] = Math.cos(angle) * radius
    dustPos[i * 3 + 1] = height
    dustPos[i * 3 + 2] = Math.sin(angle) * radius
    const c = dustColor.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.3)
    dustCol[i * 3] = c.r
    dustCol[i * 3 + 1] = c.g
    dustCol[i * 3 + 2] = c.b
  }
  const dustGeom = new THREE.BufferGeometry()
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
  dustGeom.setAttribute('color', new THREE.BufferAttribute(dustCol, 3))
  group.add(
    new THREE.Points(
      dustGeom,
      new THREE.PointsMaterial({
        size: 0.9,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
  )

  return group
}
