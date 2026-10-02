/* Website presentation only. Never reads or changes simulation/policy state. */
(() => {
  'use strict';
  const embedded = new URLSearchParams(location.search).get('embed') === '1' && parent !== window;
  document.documentElement.classList.toggle('hero-embedded', embedded);
  const send = (type, fields = {}) => {
    if (embedded) parent.postMessage({source: 'hero-tabletop-demo', type, ...fields},
      location.origin === 'null' ? '*' : location.origin);
  };
  const initialize = () => {
    const brand = document.querySelector('.brand');
    if (brand) {
      brand.href = '../index.html#interactive-demo';
      const paperTitle = 'HERO: Learning Humanoid End-Effector Control for Visual Whole-Body Open-Vocabulary Object Grasping';
      brand.setAttribute('aria-label', paperTitle + '. CoRL 2026. Back to the project page.');
      brand.innerHTML = '<span class="brand-mark" aria-hidden="true">H</span><span class="brand-copy"><span class="brand-title"><strong>HERO:</strong> Learning Humanoid End-Effector Control for Visual Whole-Body Open-Vocabulary Object Grasping</span><span class="brand-venue"><span class="hero-venue">CoRL 2026</span><span class="hero-back">Project page <span aria-hidden="true">↗</span></span></span></span>';
      document.title = paperTitle + ' | CoRL 2026 Interactive Demo';
    }
    if (!embedded) return;
    // Keep the existing buttons and their app handlers. The desktop sidebar
    // scrolls its setup controls while the action footer remains in view.
    const controls = document.querySelector('.controls');
    const actions = controls?.querySelector('.action-buttons');
    if (controls && actions && !controls.querySelector('.controls-body')) {
      const body = document.createElement('div');
      body.className = 'controls-body';
      for (const section of Array.from(controls.children)) body.appendChild(section);
      const footer = document.createElement('div');
      footer.className = 'controls-footer';
      footer.setAttribute('role', 'group');
      footer.setAttribute('aria-label', 'Simulation actions');
      footer.appendChild(actions);
      controls.append(body, footer);
    }
    const card = document.getElementById('loading-card');
    const connection = document.getElementById('connection');
    let previous = '';
    const update = () => {
      const type = card?.classList.contains('error') ? 'error'
        : card?.hidden && connection?.classList.contains('online') ? 'ready' : 'loading';
      const message = type === 'loading' || type === 'error'
        ? document.getElementById('loading-detail')?.textContent?.trim() : '';
      const key = type + message;
      if (key !== previous) { previous = key; send(type, {message}); }
    };
    const observer = new MutationObserver(update);
    if (card) observer.observe(card, {attributes: true, childList: true, subtree: true, characterData: true});
    if (connection) observer.observe(connection, {attributes: true});
    update();
    let height = 0;
    const resize = new ResizeObserver(() => {
      // Desktop fills its bounded frame, while an already-open demo can become
      // a natural single column when the user narrows the window.
      if (innerWidth > 760) return;
      const next = Math.ceil(document.querySelector('main').getBoundingClientRect().height);
      if (Math.abs(next - height) > 2) { height = next; send('resize', {height: next}); }
    });
    resize.observe(document.querySelector('main'));
    addEventListener('pagehide', () => { observer.disconnect(); resize.disconnect(); }, {once: true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once: true});
  else initialize();
})();
