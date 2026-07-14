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

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const app = document.querySelector('#app')
app.innerHTML = `
  <canvas id="c"></canvas>
  <div id="hud">
    <h1>Keplerian Solar System</h1>
    <p class="sub">Positions from Newton–Raphson solution of Kepler’s equation</p>
    <div class="row">
      <label for="speed">Time scale</label>
      <input id="speed" type="range" min="0" max="200" value="30" step="1" />
      <span id="speed-val">30 d/s</span>
    </div>
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
scene.background = new THREE.Color(0x03040a)
scene.fog = new THREE.FogExp2(0x03040a, 0.012)

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.05,
  500,
)
camera.position.set(4.5, 2.8, 5.5)

const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.dampingFactor = 0.06
controls.minDistance = 0.8
controls.maxDistance = 80
controls.target.set(0, 0, 0)

// Soft ambient so night-side planets remain visible
scene.add(new THREE.AmbientLight(0x334466, 0.22))

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------
const { group: sun } = createSun()
scene.add(sun)
scene.add(createStarfield())

const bodies = PLANETS.map((p) => {
  const body = createPlanet(p)
  scene.add(body.mesh)
  scene.add(body.orbitLine)
  return body
})

// Legend
for (const p of PLANETS) {
  const li = document.createElement('li')
  li.innerHTML = `<span class="swatch" style="background:#${p.color.toString(16).padStart(6, '0')}"></span>${p.name}`
  legend.appendChild(li)
}

// ---------------------------------------------------------------------------
// Simulation clock — deterministic: position = f(t) only
// ---------------------------------------------------------------------------
/** Simulation days elapsed from epoch */
let simDays = 0
/** Days of solar time per real second */
let timeScale = Number(speedInput.value)
let paused = false

speedInput.addEventListener('input', () => {
  timeScale = Number(speedInput.value)
  speedVal.textContent = `${timeScale} d/s`
})
pauseInput.addEventListener('change', () => {
  paused = pauseInput.checked
})

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
    simDays += dt * timeScale
  }

  // Deterministic placement from elapsed time (Kepler + Newton)
  for (const body of bodies) {
    updatePlanetPosition(body, simDays)
    // Gentle spin for visual interest (not physical rotation period)
    body.mesh.rotation.y += dt * 0.4
  }

  // Subtle sun pulse
  const pulse = 1 + 0.02 * Math.sin(simDays * 0.15)
  sun.scale.setScalar(pulse)

  controls.update()
  renderer.render(scene, camera)

  simTimeEl.textContent = `t = ${simDays.toFixed(1)} days`
}

// Place planets at t = 0 before first frame
for (const body of bodies) {
  updatePlanetPosition(body, 0)
}

animate()
