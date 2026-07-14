import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  PLANETS,
  createSun,
  createPlanet,
  createStarfield,
  updatePlanetPosition,
} from './solarSystem.js'

/** Seconds in one Earth day — used for actual real-time mode */
const SECONDS_PER_DAY = 86400

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const app = document.querySelector('#app')
app.innerHTML = `
  <canvas id="c"></canvas>
  <div id="hud">
    <h1>Keplerian Solar System</h1>
    <p class="sub">Positions from Newton–Raphson solution of Kepler’s equation · orbits on X/Z</p>

    <div class="row mode-row">
      <span class="mode-label">Time mode</span>
      <div class="mode-toggle" role="group" aria-label="Time mode">
        <button type="button" id="mode-sim" class="mode-btn active" aria-pressed="true">
          Simulation Speed
        </button>
        <button type="button" id="mode-real" class="mode-btn" aria-pressed="false">
          Actual Real Time
        </button>
      </div>
    </div>

    <div class="row" id="speed-row">
      <label for="speed">Speed</label>
      <input id="speed" type="range" min="0.1" max="100" value="1" step="0.1" />
      <span id="speed-val">1 d/s</span>
    </div>
    <p id="mode-hint" class="hint">1 second = 1 day (× speed)</p>

    <div class="row">
      <label for="pause">Paused</label>
      <input id="pause" type="checkbox" />
    </div>
    <div class="meta">
      <span id="sim-time">t = 0.0 days</span>
      <span id="fps">— fps</span>
    </div>
    <ul id="legend"></ul>
  </div>
`

const canvas = document.querySelector('#c')
const speedInput = document.querySelector('#speed')
const speedVal = document.querySelector('#speed-val')
const speedRow = document.querySelector('#speed-row')
const modeHint = document.querySelector('#mode-hint')
const modeSimBtn = document.querySelector('#mode-sim')
const modeRealBtn = document.querySelector('#mode-real')
const pauseInput = document.querySelector('#pause')
const simTimeEl = document.querySelector('#sim-time')
const fpsEl = document.querySelector('#fps')
const legend = document.querySelector('#legend')

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x010208)
// Very light fog — outer planets stay visible
scene.fog = new THREE.FogExp2(0x010208, 0.0022)

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.05,
  1000,
)
// High enough / far enough to see the full system (Neptune ~14 units out)
camera.position.set(8, 12, 14)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 0.8
controls.maxDistance = 60
controls.target.set(0, 0, 0)

// Stronger ambient so night sides and outer planets stay readable
scene.add(new THREE.AmbientLight(0x4a5a80, 0.45))
scene.add(new THREE.HemisphereLight(0x9ab4ff, 0x1a1020, 0.25))

// ---------------------------------------------------------------------------
// Bodies + starfield
// ---------------------------------------------------------------------------
const { group: sun } = createSun()
scene.add(sun)
scene.add(createStarfield({ count: 18000 }))

const bodies = PLANETS.map((p) => {
  const body = createPlanet(p)
  scene.add(body.mesh)
  scene.add(body.orbitLine)
  return body
})

for (const p of PLANETS) {
  const li = document.createElement('li')
  li.innerHTML = `<span class="swatch" style="background:#${p.color.toString(16).padStart(6, '0')}"></span>${p.name}`
  legend.appendChild(li)
}

// ---------------------------------------------------------------------------
// Simulation clock — deterministic: position = f(simDays) only
//
// Simulation Speed (default): 1 wall-clock second → speedDaysPerSec days
//   default speed = 1 → 1 second = 1 day
// Actual Real Time: 1 wall-clock second → 1 second of solar time
//   → simDays += dt / 86400
// ---------------------------------------------------------------------------
/** Elapsed solar days from epoch (drives Kepler) */
let simDays = 0
/** Simulation mode: days advanced per real second */
let speedDaysPerSec = Number(speedInput.value)
/** false = Simulation Speed, true = Actual Real Time */
let realTimeMode = false
let paused = false

function syncModeUI() {
  modeSimBtn.classList.toggle('active', !realTimeMode)
  modeRealBtn.classList.toggle('active', realTimeMode)
  modeSimBtn.setAttribute('aria-pressed', String(!realTimeMode))
  modeRealBtn.setAttribute('aria-pressed', String(realTimeMode))

  speedInput.disabled = realTimeMode
  speedRow.classList.toggle('disabled', realTimeMode)

  if (realTimeMode) {
    speedVal.textContent = '1 s/s'
    modeHint.textContent = '1 second = 1 second (true solar rate · motion is tiny)'
  } else {
    const v = speedDaysPerSec
    speedVal.textContent = `${formatSpeed(v)} d/s`
    modeHint.textContent =
      v === 1
        ? '1 second = 1 day (× speed slider)'
        : `1 second = ${formatSpeed(v)} day${v === 1 ? '' : 's'}`
  }
}

function formatSpeed(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/**
 * Days of solar time to advance for this frame.
 * Pure function of wall dt + mode + slider — Kepler still uses absolute simDays.
 */
function daysDelta(dtSeconds) {
  if (realTimeMode) {
    return dtSeconds / SECONDS_PER_DAY
  }
  return dtSeconds * speedDaysPerSec
}

speedInput.addEventListener('input', () => {
  speedDaysPerSec = Number(speedInput.value)
  syncModeUI()
})

modeSimBtn.addEventListener('click', () => {
  realTimeMode = false
  syncModeUI()
})

modeRealBtn.addEventListener('click', () => {
  realTimeMode = true
  syncModeUI()
})

pauseInput.addEventListener('change', () => {
  paused = pauseInput.checked
})

syncModeUI()

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth
  const h = window.innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}
window.addEventListener('resize', onResize)

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock()
let fpsAccum = 0
let fpsFrames = 0
let fpsTimer = 0

function formatSimTime(days) {
  if (realTimeMode && days < 2) {
    const hours = days * 24
    if (hours < 1) return `t = ${(hours * 60).toFixed(1)} min`
    return `t = ${hours.toFixed(2)} h`
  }
  if (days < 0.01) return `t = ${(days * 86400).toFixed(1)} s`
  return `t = ${days.toFixed(days < 10 ? 3 : 1)} days`
}

function animate() {
  requestAnimationFrame(animate)

  const dt = clock.getDelta()
  fpsAccum += dt
  fpsFrames += 1
  fpsTimer += dt
  if (fpsTimer >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsAccum)} fps`
    fpsAccum = 0
    fpsFrames = 0
    fpsTimer = 0
  }

  if (!paused) {
    simDays += daysDelta(dt)
  }

  // Deterministic placement from elapsed simDays (Kepler + Newton)
  for (const body of bodies) {
    updatePlanetPosition(body, simDays)
    body.mesh.rotation.y += dt * 0.4
  }

  const pulse = 1 + 0.02 * Math.sin(simDays * 0.15)
  sun.scale.setScalar(pulse)

  controls.update()
  renderer.render(scene, camera)

  simTimeEl.textContent = formatSimTime(simDays)
}

// Place planets at t = 0 before first frame
for (const body of bodies) {
  updatePlanetPosition(body, 0)
}

animate()
