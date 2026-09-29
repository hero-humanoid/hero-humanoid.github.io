(() => {
  'use strict';

  const shell = document.getElementById('hero-demo-shell');
  if (!shell) return;

  const preview = document.getElementById('hero-demo-preview');
  const host = document.getElementById('hero-demo-frame-host');
  const launch = document.getElementById('hero-demo-launch');
  const expand = document.getElementById('hero-demo-expand');
  const close = document.getElementById('hero-demo-close');
  const state = document.getElementById('hero-demo-state');
  const status = document.getElementById('hero-demo-status');
  let frame = null;
  let documentObserver = null;
  let sizeObserver = null;
  let pausedHomepageVideos = [];

  const pauseHomepageVideos = () => {
    // Free video decoding/rendering work for the live simulation, while
    // preserving videos the visitor had already paused or finished.
    pausedHomepageVideos = Array.from(document.querySelectorAll('video'))
      .filter(video => !video.paused && !video.ended);
    pausedHomepageVideos.forEach(video => video.pause());
  };

  const resumeHomepageVideos = () => {
    const videos = pausedHomepageVideos;
    pausedHomepageVideos = [];
    if (document.hidden) return;
    videos.forEach(video => {
      if (!video.isConnected || video.ended || !video.paused) return;
      try {
        // Browsers may deny playback after a tab or media state change.
        // Such a denial should never interrupt closing the simulation.
        video.play()?.catch(() => {});
      } catch { /* Keep the video's normal playback controls available. */ }
    });
  };

  const setStatus = (value, message) => {
    state.dataset.state = value;
    state.hidden = value !== 'loading' && value !== 'error';
    if (status.textContent !== message) status.textContent = message;
    host.setAttribute('aria-busy', String(value === 'loading'));
  };

  const resizeFrame = (height) => {
    if (!frame || !Number.isFinite(height)) return;
    // The desktop embed has its own scrolling controls. Only the narrow,
    // single-column layout needs document height; reading desktop scrollHeight
    // would create a feedback loop with the embed's viewport-relative layout.
    if (frame.getBoundingClientRect().width <= 760) {
      const pixels = Math.ceil(Math.max(640, Math.min(height, 4800)));
      frame.style.height = `${pixels}px`;
    } else {
      frame.style.removeProperty('height');
    }
  };

  const disconnectObservers = () => {
    documentObserver?.disconnect();
    sizeObserver?.disconnect();
    documentObserver = null;
    sizeObserver = null;
  };

  const observeLoadedDocument = () => {
    disconnectObservers();
    if (!frame) return;
    // Read-only fallback for a same-origin embed. No app state, policy,
    // controller, worker, or simulation methods are accessed here.
    try {
      const doc = frame.contentDocument;
      if (!doc?.body || !doc.querySelector('#simulation')) {
        setStatus('error', 'Could not load the demo. Close it and try again.');
        return;
      }
      const loadingCard = doc.getElementById('loading-card');
      const sync = () => {
        if (loadingCard?.classList.contains('error')) {
          setStatus('error', 'The simulation could not start. Try opening it in a new tab.');
        } else if (loadingCard?.hidden) {
          setStatus('ready', 'Ready to interact');
        } else {
          setStatus('loading', 'Loading robot and policy…');
        }
        if (frame?.getBoundingClientRect().width <= 760) {
          resizeFrame(Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight));
        }
      };
      if (loadingCard) {
        documentObserver = new MutationObserver(sync);
        documentObserver.observe(loadingCard, { attributes: true, attributeFilter: ['hidden', 'class'] });
      }
      if (typeof ResizeObserver !== 'undefined') {
        sizeObserver = new ResizeObserver(() => {
          if (frame?.getBoundingClientRect().width <= 760) resizeFrame(doc.body.scrollHeight);
        });
        sizeObserver.observe(doc.body);
      }
      sync();
    } catch {
      // A cross-origin navigation cannot be inspected; leave the standalone
      // link and explicit close control available without changing the session.
      setStatus('error', 'Open the demo in a new tab to continue.');
    }
  };

  launch.addEventListener('click', (event) => {
    // Small screens use the standalone layout and its Back to HERO link.
    // Modifier-clicks and JavaScript-free navigation keep normal link behavior.
    if (window.innerWidth <= 760 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (frame) return;
    // The existing floating contents panel sits over the demo's controls.
    // Use its own toggle so its open-state bookkeeping stays consistent.
    if (document.getElementById('tocPanel')?.classList.contains('open')) {
      document.getElementById('tocToggle')?.click();
    }
    pauseHomepageVideos();
    setStatus('loading', 'Loading simulator…');
    preview.hidden = true;
    host.hidden = false;
    expand.hidden = false;
    close.hidden = false;
    frame = document.createElement('iframe');
    frame.id = 'hero-tabletop-frame';
    frame.title = 'HERO interactive tabletop grasping simulation';
    frame.allow = 'fullscreen';
    frame.allowFullscreen = true;
    frame.addEventListener('load', observeLoadedDocument);
    frame.addEventListener('error', () => setStatus('error', 'Could not load the demo. Close it and try again.'));
    // Deliberately assigned only after this explicit user action. There is no
    // hidden iframe, preload, fetch, or simulation asset request on page load.
    frame.src = './demo/index.html?embed=1';
    host.appendChild(frame);
    expand.focus({ preventScroll: true });
  });

  expand.addEventListener('click', () => {
    const expanded = shell.classList.toggle('is-expanded');
    expand.setAttribute('aria-expanded', String(expanded));
    expand.querySelector('[data-expand-label]').textContent = expanded ? 'Compact view' : 'Expand view';
    // Keep the existing browsing context and simulation session intact.
    if (frame && frame.getBoundingClientRect().width > 760) frame.style.removeProperty('height');
  });

  close.addEventListener('click', () => {
    disconnectObservers();
    frame?.remove();
    frame = null;
    host.hidden = true;
    preview.hidden = false;
    expand.hidden = true;
    close.hidden = true;
    shell.classList.remove('is-expanded');
    expand.setAttribute('aria-expanded', 'false');
    expand.querySelector('[data-expand-label]').textContent = 'Expand view';
    setStatus('idle', 'Session closed · launch to start again');
    resumeHomepageVideos();
    launch.focus({ preventScroll: true });
  });

  window.addEventListener('message', (event) => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || message.source !== 'hero-tabletop-demo') return;
    if (message.type === 'ready') setStatus('ready', 'Ready to interact');
    if (message.type === 'loading') setStatus('loading', 'Loading robot and policy…');
    if (message.type === 'error') setStatus('error', 'The simulation could not start. Try opening it in a new tab.');
    if (message.type === 'resize') resizeFrame(message.height);
  });

  window.addEventListener('resize', () => {
    if (frame && frame.getBoundingClientRect().width > 760) frame.style.removeProperty('height');
  }, { passive: true });
})();
