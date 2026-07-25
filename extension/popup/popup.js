// SecureVault Extension - Popup Script

let currentDomain = ''
let currentTab    = null
let credentials   = []

// ─── DOM refs ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)

const statusDot   = $('status-indicator')
const statusLabel = $('status-label')

// ─── On popup open ────────────────────────────────────────────────────────
async function init() {
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  currentTab  = tab

  try {
    const url   = new URL(tab.url)
    currentDomain = url.hostname.replace(/^www\./, '')
  } catch {
    currentDomain = ''
  }

  // Update site display
  if (currentDomain) {
    $('site-domain').textContent = currentDomain
    const favicon = $('site-favicon')
    favicon.src = `https://www.google.com/s2/favicons?domain=${currentDomain}&sz=32`
    favicon.onerror = () => favicon.classList.add('hidden')
    favicon.onload  = () => favicon.classList.remove('hidden')
  }

  // Check status
  const status = await sendMsg({ type: 'CHECK_STATUS' })

  if (!status || !status.running) {
    setUIState('disconnected')
    return
  }

  if (status.locked) {
    setUIState('locked')
    return
  }

  setUIState('connected')
  await loadCredentials()
}

// ─── UI State Management ─────────────────────────────────────────────────
function setUIState(state) {
  // Hide all panels
  $('state-loading').classList.add('hidden')
  $('state-disconnected').classList.add('hidden')
  $('state-locked').classList.add('hidden')
  $('state-connected').classList.add('hidden')

  // Update status indicator
  statusDot.className = 'status-dot'
  switch (state) {
    case 'loading':
      $('state-loading').classList.remove('hidden')
      statusDot.classList.add('status-unknown')
      statusLabel.textContent = 'Checking'
      break
    case 'disconnected':
      $('state-disconnected').classList.remove('hidden')
      statusDot.classList.add('status-disconnected')
      statusLabel.textContent = 'Offline'
      break
    case 'locked':
      $('state-locked').classList.remove('hidden')
      statusDot.classList.add('status-locked')
      statusLabel.textContent = 'Locked'
      break
    case 'connected':
      $('state-connected').classList.remove('hidden')
      statusDot.classList.add('status-connected')
      statusLabel.textContent = 'Connected'
      break
  }
}

// ─── Load credentials for current site ───────────────────────────────────
async function loadCredentials() {
  if (!currentDomain) {
    $('no-credentials').classList.remove('hidden')
    return
  }

  const res = await sendMsg({ type: 'GET_CREDENTIALS', domain: currentDomain })

  if (res?.success && res.data?.length) {
    credentials = res.data
    renderCredentials(res.data)
    $('no-credentials').classList.add('hidden')
  } else {
    credentials = []
    $('no-credentials').classList.remove('hidden')
    $('credentials-list').innerHTML = ''
  }
}

// ─── Render credential cards ──────────────────────────────────────────────
function renderCredentials(creds) {
  const list = $('credentials-list')
  list.innerHTML = ''

  creds.forEach(cred => {
    const card = document.createElement('div')
    card.className = 'cred-card'

    const identity = cred.email || cred.username || 'No username'

    card.innerHTML = `
      <div class="cred-identity">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        ${escapeHtml(identity)}
      </div>
      <div class="cred-password-row">
        <span class="cred-password-text" id="pwd-text-${cred.id}">••••••••••••</span>
        <button class="btn btn-sm btn-secondary" id="toggle-pwd-${cred.id}" title="Show/hide password">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
      </div>
      <div class="cred-actions">
        <button class="btn btn-sm btn-primary" id="fill-${cred.id}">Fill</button>
        <button class="btn btn-sm btn-secondary" id="copy-${cred.id}">Copy Password</button>
      </div>
    `

    list.appendChild(card)

    // Show/hide password
    let isShown = false
    document.getElementById(`toggle-pwd-${cred.id}`).onclick = () => {
      isShown = !isShown
      document.getElementById(`pwd-text-${cred.id}`).textContent =
        isShown ? cred.password : '••••••••••••'
    }

    // Fill button
    document.getElementById(`fill-${cred.id}`).onclick = async () => {
      await chrome.tabs.sendMessage(currentTab.id, {
        type:     'FILL_FIELDS',
        username: cred.email || cred.username || '',
        password: cred.password,
      })
      // Update last used
      sendMsg({ type: 'UPDATE_LAST_USED', id: cred.id })
      const btn = document.getElementById(`fill-${cred.id}`)
      if (btn) { btn.textContent = 'Filled!'; btn.classList.replace('btn-primary', 'btn-success') }
    }

    // Copy password
    document.getElementById(`copy-${cred.id}`).onclick = async () => {
      await navigator.clipboard.writeText(cred.password)
      const btn = document.getElementById(`copy-${cred.id}`)
      if (btn) {
        btn.textContent = 'Copied!'
        setTimeout(() => {
          if (btn) btn.textContent = 'Copy Password'
          navigator.clipboard.writeText('')
        }, 2000)
      }
    }
  })
}

// ─── Unlock handler ───────────────────────────────────────────────────────
$('unlock-btn').onclick = async () => {
  const pwd = $('unlock-password').value
  if (!pwd) return

  $('unlock-btn').textContent = 'Verifying...'
  $('unlock-btn').disabled = true

  const res = await fetch('http://localhost:45678/api/auth/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ masterPassword: pwd }),
  }).then(r => r.json()).catch(() => ({ success: false }))

  if (res.success && res.token) {
    await sendMsg({ type: 'SAVE_TOKEN', token: res.token })
    $('unlock-error').classList.add('hidden')
    setUIState('connected')
    await loadCredentials()
  } else {
    $('unlock-error').classList.remove('hidden')
    $('unlock-btn').textContent = 'Unlock'
    $('unlock-btn').disabled = false
    $('unlock-password').value = ''
    $('unlock-password').focus()
  }
}

// Enter key for unlock
$('unlock-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('unlock-btn').click()
})

// ─── Quick action buttons ─────────────────────────────────────────────────
$('btn-open-app').onclick = () => {
  // App is already running since we're connected; just close popup
  window.close()
}

$('btn-generate').onclick = () => {
  // Generate a random password and copy it
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()'
  let pwd = ''
  const array = new Uint32Array(20)
  crypto.getRandomValues(array)
  array.forEach(n => { pwd += chars[n % chars.length] })
  navigator.clipboard.writeText(pwd)
  const btn = $('btn-generate')
  btn.textContent = '✓ Copied to clipboard!'
  setTimeout(() => { btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1M4.22 4.22l.7.7m12.16 12.16.7.7M3 12h1m16 0h1M4.22 19.78l.7-.7M18.36 5.64l.7-.7"/></svg> Generate Password` }, 2000)
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function sendMsg(msg) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage(msg, resolve)
    } catch {
      resolve(null)
    }
  })
}

function escapeHtml(str) {
  const d = document.createElement('div')
  d.textContent = str || ''
  return d.innerHTML
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
init()
