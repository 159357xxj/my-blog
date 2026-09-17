(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function splitBannerTitle() {
    const description = document.querySelector('.home-banner-container .description');
    if (!description || description.dataset.splitReady === 'true') return;

    const titleNode = Array.from(description.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()
    );
    if (!titleNode) return;

    const title = titleNode.textContent.trim();
    const wrapper = document.createElement('span');
    wrapper.className = 'split-title';
    wrapper.setAttribute('role', 'text');
    wrapper.setAttribute('aria-label', title);

    Array.from(title).forEach((character, index) => {
      const span = document.createElement('span');
      span.className = 'split-char';
      span.setAttribute('aria-hidden', 'true');
      span.style.setProperty('--char-index', index);
      span.textContent = character === ' ' ? '\u00a0' : character;
      wrapper.appendChild(span);
    });

    titleNode.replaceWith(wrapper);
    description.dataset.splitReady = 'true';
  }

  function enableSpotlightCards() {
    document.querySelectorAll('.home-article-item:not([data-spotlight-ready])').forEach((card) => {
      card.dataset.spotlightReady = 'true';
      card.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        const bounds = card.getBoundingClientRect();
        card.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
        card.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
        card.classList.add('is-spotlight-active');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('is-spotlight-active');
      });
    });
  }

  function mountAurora() {
    const host = document.querySelector('.home-banner-background');
    if (!host || host.querySelector('.native-aurora')) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'native-aurora';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    let width = 1;
    let height = 1;
    let pointerX = 0;
    let pointerY = 0;
    let frame = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      const bounds = host.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function ribbon(time, offset, colorA, colorB, amplitude, thickness) {
      const top = [];
      const bottom = [];
      const segments = 42;

      for (let index = 0; index <= segments; index += 1) {
        const x = (index / segments) * width;
        const phase = index * 0.2 + time + offset;
        const center = height * (0.45 + offset * 0.035)
          + Math.sin(phase) * amplitude
          + Math.sin(phase * 0.47) * amplitude * 0.55
          + pointerY * 12;
        const depth = thickness + Math.sin(phase * 0.7) * 24;
        top.push([x, center - depth]);
        bottom.unshift([x, center + depth]);
      }

      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, colorA);
      gradient.addColorStop(0.55, colorB);
      gradient.addColorStop(1, 'rgba(8, 145, 178, 0.05)');

      context.beginPath();
      top.concat(bottom).forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fillStyle = gradient;
      context.fill();
    }

    function draw(timestamp) {
      if (!canvas.isConnected) return;
      const time = timestamp * 0.00032 + pointerX * 0.18;
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = '#071316';
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = 'screen';
      ribbon(time, 0.2, 'rgba(20, 184, 166, 0.50)', 'rgba(45, 212, 191, 0.22)', 48, 78);
      ribbon(time * 0.86, 1.6, 'rgba(239, 131, 84, 0.34)', 'rgba(132, 204, 22, 0.16)', 66, 62);
      ribbon(time * 1.12, 3.0, 'rgba(8, 145, 178, 0.28)', 'rgba(94, 234, 212, 0.15)', 38, 54);
      context.globalCompositeOperation = 'source-over';

      if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
    }

    function handlePointer(event) {
      const bounds = host.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
      pointerY = (event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5;
    }

    resize();
    draw(0);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize, { passive: true });
    host.addEventListener('pointermove', handlePointer, { passive: true });

    reducedMotion.addEventListener('change', () => {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) draw(0);
      else frame = window.requestAnimationFrame(draw);
    });
  }

  function initializeEnhancements() {
    splitBannerTitle();
    enableSpotlightCards();
    mountAurora();
  }

  document.addEventListener('DOMContentLoaded', initializeEnhancements);
  document.addEventListener('swup:contentReplaced', initializeEnhancements);
  document.addEventListener('swup:page:view', initializeEnhancements);
  window.addEventListener('load', initializeEnhancements);

  const observer = new MutationObserver(() => window.requestAnimationFrame(initializeEnhancements));
  observer.observe(document.documentElement, { childList: true, subtree: true });
}());
