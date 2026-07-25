// SecureVault Extension - Background Service Worker
// Handles all API communication with the desktop app

const API_BASE = 'http://localhost:45678/api'

// ─── In-memory state ──────────────────────────────────────────────────────
let cachedToken   = null
let appStatus     = { running: false, locked: true }

// ─── Startup ──────────────────────────────────────────────────────────────
async function init() {
  // Load saved token
  const { svToken } = await chrome.storage.local.get('svToken')
  cachedToken = svToken || null

  // Check app status
  await checkStatus()
}

// ─── Status check ─────────────────────────────────────────────────────────
async function checkStatus() {
  try {
    const res  = await fetch(`${API_BASE}/status`, { method: 'GET' })
    const data = await res.json()
    appStatus  = { running: data.running, locked: data.locked }
  } catch {
    appStatus = { running: false, locked: true }
  }
  return appStatus
}

// ─── API helper ───────────────────────────────────────────────────────────
async function callAPI(endpoint, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token || cachedToken) {
    headers['Authorization'] = `Bearer ${token || cachedToken}`
  }

  const opts = { method, headers }
  if (body && (method === 'POST' || method === 'PUT')) {
    opts.body = JSON.stringify(body)
  }

  try {
    const res  = await fetch(`${API_BASE}${endpoint}`, opts)
    const data = await res.json()
    return data
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Notification helper ──────────────────────────────────────────────────
function showNotification(title, message) {
  chrome.notifications.create(`sv-${Date.now()}`, {
    type:     'basic',
    iconUrl:  '../icons/icon128.png',
    title,
    message,
  })
}

// ─── Message listener ─────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse).catch(err => {
    sendResponse({ success: false, error: err.message })
  })
  return true  // Keep channel open for async response
})

async function handleMessage(msg) {
  switch (msg.type) {

    case 'CHECK_STATUS': {
      const status = await checkStatus()
      return status
    }

    case 'GET_CREDENTIALS': {
      const { domain } = msg
      if (!cachedToken) return { success: false, error: 'No token', data: [] }

      const res = await callAPI(`/credentials?domain=${encodeURIComponent(domain)}`, 'GET')
      if (res.success) return { success: true, data: res.data || [] }
      return { success: false, data: [], error: res.error }
    }

    case 'SAVE_CREDENTIAL': {
      const { domain, website_name, username, email, password } = msg
      if (!cachedToken) return { success: false, error: 'No token' }

      const res = await callAPI('/credentials/save', 'POST', {
        domain, website_name, username, email, password,
      })

      if (res.success && res.action === 'created') {
        showNotification('SecureVault', `Password saved for ${domain}`)
        return { success: true, action: 'created', id: res.id }
      }
      if (res.success && res.action === 'exists') {
        return { success: true, action: 'exists', existingId: res.existingId }
      }
      return { success: false, error: res.error }
    }

    case 'UPDATE_CREDENTIAL': {
      const { id, ...data } = msg
      if (!cachedToken) return { success: false, error: 'No token' }

      const res = await callAPI(`/credentials/update/${id}`, 'PUT', data)
      if (res.success) {
        showNotification('SecureVault', `Password updated`)
        return { success: true }
      }
      return { success: false, error: res.error }
    }

    case 'UPDATE_LAST_USED': {
      if (!cachedToken) return { success: false }
      await callAPI(`/credentials/last-used/${msg.id}`, 'POST')
      return { success: true }
    }

    case 'SAVE_TOKEN': {
      cachedToken = msg.token
      await chrome.storage.local.set({ svToken: msg.token })
      return { success: true }
    }

    case 'GET_TOKEN': {
      const { svToken } = await chrome.storage.local.get('svToken')
      return { token: svToken || null }
    }

    case 'CLEAR_TOKEN': {
      cachedToken = null
      await chrome.storage.local.remove('svToken')
      return { success: true }
    }

    case 'LOCK_APP': {
      await callAPI('/lock', 'POST')
      return { success: true }
    }

    default:
      return { success: false, error: `Unknown message type: ${msg.type}` }
  }
}

// ─── Init on service worker start ────────────────────────────────────────
init()
