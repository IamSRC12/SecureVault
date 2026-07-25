// SecureVault Extension - Content Script
// Handles form detection, autofill button, and save banner

;(function() {
  // Don't run on restricted pages
  if (
    location.protocol === 'chrome:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    document.querySelector('[data-securevault-injected]')
  ) return

  // Mark as injected
  const marker = document.createElement('meta')
  marker.setAttribute('data-securevault-injected', 'true')
  document.head.appendChild(marker)

  // ─── State ──────────────────────────────────────────────────────────────
  let usernameField = null
  let passwordField = null
  let autofillBtn   = null
  let saveTimer     = null
  const domain = location.hostname.replace(/^www\./, '')

  // ─── Form Detection ──────────────────────────────────────────────────────
  function detectForm() {
    const pwdInputs = Array.from(document.querySelectorAll('input[type="password"]'))
      .filter(el => el.offsetParent !== null && !el.closest('[data-securevault]'))

    if (!pwdInputs.length) return

    passwordField = pwdInputs[0]

    // Find username/email field near password
    const form      = passwordField.closest('form')
    const container = form || passwordField.closest('div,section,main') || document.body

    const emailInput = container.querySelector('input[type="email"]')
    const textInput  = Array.from(container.querySelectorAll('input[type="text"]'))
      .find(el => {
        const name = (el.name + el.id + el.placeholder).toLowerCase()
        return /user|email|login|account|name/.test(name)
      })

    usernameField = emailInput || textInput

    injectAutofillButton()
    listenForSubmit()
    checkAutofill()
  }

  // ─── Autofill Check ──────────────────────────────────────────────────────
  function checkAutofill() {
    chrome.runtime.sendMessage({ type: 'GET_CREDENTIALS', domain }, (res) => {
      if (!res?.success || !res.data?.length) return
      showAutofillButton(res.data)
    })
  }

  // ─── Autofill Button ─────────────────────────────────────────────────────
  function injectAutofillButton() {
    if (autofillBtn) autofillBtn.remove()
    const targetField = usernameField || passwordField
    if (!targetField) return

    autofillBtn = document.createElement('button')
    autofillBtn.setAttribute('data-securevault', 'autofill')
    autofillBtn.setAttribute('type', 'button')
    autofillBtn.title = 'Autofill with SecureVault'
    autofillBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="white">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
      </svg>
    `
    Object.assign(autofillBtn.style, {
      position:        'absolute',
      right:           '8px',
      top:             '50%',
      transform:       'translateY(-50%)',
      width:           '24px',
      height:          '24px',
      background:      '#6366f1',
      border:          'none',
      borderRadius:    '4px',
      cursor:          'pointer',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      zIndex:          '2147483646',
      padding:         '0',
    })

    // Wrap field in relative container
    const wrapper = document.createElement('div')
    Object.assign(wrapper.style, { position: 'relative', display: 'inline-block', width: '100%' })
    targetField.parentNode.insertBefore(wrapper, targetField)
    wrapper.appendChild(targetField)
    wrapper.appendChild(autofillBtn)
  }

  function showAutofillButton(credentials) {
    if (!autofillBtn) return
    autofillBtn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (credentials.length === 1) {
        fillCredentials(credentials[0])
      } else {
        showPicker(credentials)
      }
    }
  }

  // ─── Credential Picker ───────────────────────────────────────────────────
  function showPicker(credentials) {
    const existing = document.querySelector('[data-sv-picker]')
    if (existing) existing.remove()

    const picker = document.createElement('div')
    picker.setAttribute('data-sv-picker', 'true')
    Object.assign(picker.style, {
      position:     'absolute',
      top:          '100%',
      right:        '0',
      marginTop:    '4px',
      background:   '#1a1a1a',
      border:       '1px solid #2a2a2a',
      borderRadius: '8px',
      boxShadow:    '0 4px 20px rgba(0,0,0,0.5)',
      zIndex:       '2147483647',
      minWidth:     '220px',
      overflow:     'hidden',
    })

    credentials.forEach(cred => {
      const item = document.createElement('button')
      item.type  = 'button'
      item.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;background:transparent;border:none;width:100%;text-align:left">
          <img src="https://www.google.com/s2/favicons?domain=${cred.domain}&sz=16" width="16" height="16" style="border-radius:2px" onerror="this.style.display='none'">
          <div>
            <div style="color:#f1f5f9;font-size:13px;font-family:system-ui,sans-serif">${escapeHtml(cred.email || cred.username || cred.domain)}</div>
            <div style="color:#475569;font-size:11px;font-family:system-ui,sans-serif">${escapeHtml(cred.website_name)}</div>
          </div>
        </div>
      `
      item.onmouseover = () => item.style.background = '#2a2a2a'
      item.onmouseout  = () => item.style.background = 'transparent'
      item.onclick = () => { picker.remove(); fillCredentials(cred) }
      picker.appendChild(item)
    })

    const wrapper = autofillBtn.parentElement
    if (wrapper) wrapper.appendChild(picker)

    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function onOutside() {
        picker.remove()
        document.removeEventListener('click', onOutside)
      }, { once: true })
    }, 0)
  }

  // ─── Field Filling ───────────────────────────────────────────────────────
  function fillField(el, value) {
    if (!el) return
    el.focus()
    const nativeInput = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    nativeInput.set.call(el, value)
    el.dispatchEvent(new Event('input',  { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
  }

  function fillCredentials(cred) {
    if (usernameField) fillField(usernameField, cred.email || cred.username || '')
    if (passwordField) fillField(passwordField, cred.password)

    // Update last used
    chrome.runtime.sendMessage({ type: 'UPDATE_LAST_USED', id: cred.id })
  }

  // ─── Submit Detection ─────────────────────────────────────────────────────
  function listenForSubmit() {
    const form = passwordField?.closest('form')

    const handleSubmit = () => {
      const pwd  = passwordField?.value
      if (!pwd) return

      const usr  = usernameField?.value || ''
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usr)

      captureAndSave({
        domain,
        website_name: document.title || domain,
        username:     isEmail ? null : usr,
        email:        isEmail ? usr : null,
        password:     pwd,
      })
    }

    if (form) {
      form.addEventListener('submit', handleSubmit)
    }

    // Listen for submit button clicks
    document.querySelectorAll('button[type="submit"], input[type="submit"]').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(handleSubmit, 100))
    })

    // Listen for Enter key
    passwordField?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') setTimeout(handleSubmit, 100)
    })
  }

  // ─── Save Flow ────────────────────────────────────────────────────────────
  function captureAndSave(data) {
    chrome.runtime.sendMessage({ type: 'SAVE_CREDENTIAL', ...data }, (res) => {
      if (!res) return
      if (res.action === 'created' && res.success) {
        showSaveBanner(`✓ Password saved to SecureVault`, 'success', null, null)
      } else if (res.action === 'exists') {
        showSaveBanner(
          `Update saved password for ${data.domain}?`,
          'update',
          () => chrome.runtime.sendMessage({
            type: 'UPDATE_CREDENTIAL',
            id:   res.existingId,
            ...data,
          }),
          null
        )
      }
    })
  }

  // ─── Save Banner ──────────────────────────────────────────────────────────
  function showSaveBanner(message, type, onAccept, onDismiss) {
    const existing = document.querySelector('[data-sv-banner]')
    if (existing) existing.remove()

    const banner = document.createElement('div')
    banner.setAttribute('data-sv-banner', 'true')
    Object.assign(banner.style, {
      position:       'fixed',
      top:            '0',
      left:           '0',
      right:          '0',
      zIndex:         '2147483647',
      background:     '#1a1a1a',
      borderBottom:   '2px solid #6366f1',
      padding:        '12px 20px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
      fontFamily:     'system-ui,-apple-system,sans-serif',
      fontSize:       '14px',
      color:          '#f1f5f9',
      transform:      'translateY(-100%)',
      transition:     'transform 0.3s ease',
      boxSizing:      'border-box',
    })

    const left = document.createElement('div')
    left.style.display = 'flex'
    left.style.alignItems = 'center'
    left.style.gap = '10px'

    // Shield icon
    const icon = document.createElement('span')
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#6366f1"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>`
    left.appendChild(icon)

    const text = document.createElement('span')
    text.textContent = message
    left.appendChild(text)
    banner.appendChild(left)

    const right = document.createElement('div')
    right.style.display = 'flex'
    right.style.gap = '8px'

    if (type === 'update' && onAccept) {
      const updateBtn = createBannerBtn('Update', '#6366f1', '#fff')
      updateBtn.onclick = () => { onAccept(); banner.remove() }
      right.appendChild(updateBtn)
    }

    const dismissBtn = createBannerBtn('Dismiss', 'transparent', '#94a3b8')
    dismissBtn.style.border = '1px solid #2a2a2a'
    dismissBtn.onclick = () => dismiss()
    right.appendChild(dismissBtn)

    banner.appendChild(right)
    document.body.appendChild(banner)

    requestAnimationFrame(() => { banner.style.transform = 'translateY(0)' })

    function dismiss() {
      banner.style.transform = 'translateY(-100%)'
      setTimeout(() => banner.remove(), 300)
    }

    // Auto-dismiss
    const timeout = type === 'success' ? 3000 : 15000
    setTimeout(dismiss, timeout)
  }

  function createBannerBtn(label, bg, color) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    Object.assign(btn.style, {
      background:   bg,
      color,
      border:       'none',
      borderRadius: '6px',
      padding:      '5px 12px',
      cursor:       'pointer',
      fontSize:     '13px',
      fontFamily:   'system-ui,-apple-system,sans-serif',
    })
    return btn
  }

  // ─── Message listener (for popup fill) ───────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'FILL_FIELDS') {
      if (usernameField) fillField(usernameField, msg.username || '')
      if (passwordField) fillField(passwordField, msg.password || '')
      sendResponse({ success: true })
    }
    return true
  })

  // ─── MutationObserver for SPAs ────────────────────────────────────────────
  let detectDebounce = null
  const observer = new MutationObserver(() => {
    if (detectDebounce) clearTimeout(detectDebounce)
    detectDebounce = setTimeout(() => {
      if (document.querySelector('input[type="password"]:not([data-sv-scanned])')) {
        detectForm()
      }
    }, 500)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str || ''
    return div.innerHTML
  }

  // ─── Initial Detection ────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', detectForm)
  } else {
    detectForm()
  }

})()
