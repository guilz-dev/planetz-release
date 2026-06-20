import { getLocale, initI18n, translate } from './i18n/locale.js'

initI18n()

const header = document.querySelector('[data-header]')
const navToggle = document.querySelector('[data-nav-toggle]')
const mobileNav = document.querySelector('[data-mobile-nav]')
const waitlistForm = document.querySelector('[data-waitlist-form]')
const waitlistMsg = document.querySelector('[data-waitlist-msg]')
const teaserSection = document.querySelector('[data-teaser-section]')
const teaserEmbed = document.querySelector('[data-teaser-embed]')
const teaserWatchLink = document.querySelector('[data-teaser-watch]')
const teaserDownloadLink = document.querySelector('[data-teaser-download]')

function closeMobileNav() {
  if (!navToggle || !mobileNav) return
  navToggle.setAttribute('aria-expanded', 'false')
  mobileNav.hidden = true
}

if (navToggle && mobileNav) {
  navToggle.addEventListener('click', () => {
    const open = navToggle.getAttribute('aria-expanded') === 'true'
    navToggle.setAttribute('aria-expanded', String(!open))
    mobileNav.hidden = open
  })

  for (const link of mobileNav.querySelectorAll('a')) {
    link.addEventListener('click', closeMobileNav)
  }
}

if (header) {
  const onScroll = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8)
  }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
}

function readTeaserYouTubeId() {
  const raw = import.meta.env.VITE_YOUTUBE_TEASER_ID
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return '8j3AIhbUAPY'
}

function readDesktopDownloadUrl() {
  const raw = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  return 'https://github.com/guilz-dev/planetz-release/releases/latest/download/Planetz-Agent-Deck.dmg'
}

function configureTeaserSection() {
  const downloadUrl = readDesktopDownloadUrl()
  if (teaserDownloadLink instanceof HTMLAnchorElement) {
    teaserDownloadLink.href = downloadUrl
  }

  if (!(teaserSection instanceof HTMLElement) || !(teaserEmbed instanceof HTMLIFrameElement)) {
    return
  }

  const teaserId = readTeaserYouTubeId()
  if (!teaserId) {
    teaserSection.hidden = true
    return
  }

  teaserEmbed.src = `https://www.youtube.com/embed/${encodeURIComponent(teaserId)}`
  if (teaserWatchLink instanceof HTMLAnchorElement) {
    teaserWatchLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(teaserId)}`
  }
  teaserSection.hidden = false
}

configureTeaserSection()

const revealEls = document.querySelectorAll('.reveal')
if (revealEls.length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  for (const el of revealEls) observer.observe(el)
} else {
  for (const el of revealEls) el.classList.add('is-visible')
}

const FREEWAITLISTS_API_ORIGIN = 'https://api.freewaitlists.com/waitlists'

function readFreeWaitlistsWaitlistId() {
  const fromEnv = import.meta.env.VITE_FREEWAITLISTS_WAITLIST_ID
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return ''
}

function setWaitlistMessage(element, text, variant) {
  element.hidden = false
  element.textContent = text
  element.classList.toggle('is-error', variant === 'error')
  element.classList.toggle('is-success', variant === 'success')
}

async function submitCloudWaitlist(email) {
  const waitlistId = readFreeWaitlistsWaitlistId()
  if (!waitlistId) {
    throw new Error('WAITLIST_NOT_CONFIGURED')
  }

  const response = await fetch(`${FREEWAITLISTS_API_ORIGIN}/${waitlistId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      meta: { source: 'planetz-landing' },
    }),
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload.message === 'string'
        ? payload.message
        : payload && typeof payload.error === 'string'
          ? payload.error
          : null
    const err = new Error(detail ?? 'WAITLIST_REQUEST_FAILED')
    err.status = response.status
    throw err
  }

  return payload
}

if (waitlistForm && waitlistMsg) {
  const submitButton = waitlistForm.querySelector('button[type="submit"]')

  waitlistForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    const rawEmail = new FormData(waitlistForm).get('email')
    if (typeof rawEmail !== 'string') return

    const email = rawEmail.trim().toLowerCase()
    if (!email.includes('@')) return

    waitlistMsg.hidden = true
    waitlistMsg.classList.remove('is-error', 'is-success')
    waitlistForm.setAttribute('aria-busy', 'true')
    if (submitButton) submitButton.disabled = true

    const locale = getLocale()

    try {
      await submitCloudWaitlist(email)
      setWaitlistMessage(waitlistMsg, translate('waitlist.success', locale) ?? '', 'success')
      waitlistForm.reset()
    } catch (error) {
      if (error instanceof Error && error.message === 'WAITLIST_NOT_CONFIGURED') {
        setWaitlistMessage(waitlistMsg, translate('waitlist.notConfigured', locale) ?? '', 'error')
      } else {
        setWaitlistMessage(waitlistMsg, translate('waitlist.error', locale) ?? '', 'error')
      }
    } finally {
      waitlistForm.removeAttribute('aria-busy')
      if (submitButton) submitButton.disabled = false
    }
  })
}
