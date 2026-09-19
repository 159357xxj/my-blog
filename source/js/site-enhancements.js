(function () {
  'use strict';

  if (window.__chenyipingEnhancements) {
    window.__chenyipingEnhancements.refresh();
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, progress) => from + (to - from) * progress;
  const random = (min, max) => min + Math.random() * (max - min);
  const easeInOut = (progress) => (
    progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2
  );

  let heroController = null;

  function getParticleConfig() {
    return {
      title: window.theme?.home_banner?.title || '陈一平的博客',
      subtitles: ['代码 · 学习 · 生活', '记录问题，也记录答案']
    };
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
      card.addEventListener('pointerleave', () => card.classList.remove('is-spotlight-active'));
    });
  }

  function addHeroAccessibility(host, config) {
    const semantic = document.createElement('div');
    semantic.className = 'particle-a11y';
    const heading = document.createElement('h1');
    heading.textContent = config.title;
    const subtitle = document.createElement('p');
    subtitle.dataset.particleSubtitle = 'true';
    subtitle.setAttribute('aria-live', 'polite');
    subtitle.textContent = config.subtitles[0];
    semantic.append(heading, subtitle);

    const fallback = document.createElement('div');
    fallback.className = 'particle-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    const fallbackTitle = document.createElement('h1');
    fallbackTitle.textContent = config.title;
    const fallbackSubtitle = document.createElement('p');
    fallbackSubtitle.textContent = config.subtitles[0];
    fallback.append(fallbackTitle, fallbackSubtitle);

    host.append(semantic, fallback);
    return { semantic, fallback, subtitle };
  }

  function mountParticleHero(host, config) {
    const canvas = document.createElement('canvas');
    canvas.className = 'particle-hero-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);

    const context = canvas.getContext('2d', { alpha: false });
    const maskCanvas = document.createElement('canvas');
    const maskContext = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!context || !maskContext) {
      canvas.remove();
      return null;
    }

    const semantics = addHeroAccessibility(host, config);
    const abortController = new AbortController();
    const state = {
      width: 1,
      height: 1,
      oldWidth: 1,
      oldHeight: 1,
      ratio: 1,
      titleParticles: [],
      subtitleParticles: [],
      subtitleTargets: [],
      subtitleIndex: 0,
      morph: null,
      nextMorphAt: 0,
      stars: [],
      pointer: { x: 0, y: 0, active: false },
      frame: 0,
      lastTime: 0,
      destroyed: false
    };

    function particleColor(group, index) {
      if (group === 'title') {
        return index % 7 === 0 ? 'rgba(255, 182, 145, 0.98)' : 'rgba(216, 255, 247, 0.98)';
      }
      return index % 5 === 0 ? 'rgba(255, 171, 137, 0.96)' : 'rgba(151, 255, 231, 0.96)';
    }

    function createParticle(target, group, index, total) {
      const angle = random(0, Math.PI * 2);
      const distance = random(
        Math.max(state.width, state.height) * 0.26,
        Math.max(state.width, state.height) * 0.85
      );
      return {
        x: state.width * 0.5 + Math.cos(angle) * distance,
        y: state.height * 0.5 + Math.sin(angle) * distance,
        vx: random(-1.8, 1.8),
        vy: random(-1.8, 1.8),
        tx: target.x,
        ty: target.y,
        fromTx: target.x,
        fromTy: target.y,
        toTx: target.x,
        toTy: target.y,
        size: group === 'title' ? random(1.05, 2.05) : random(0.78, 1.55),
        color: particleColor(group, index),
        phase: random(0, Math.PI * 2),
        group,
        order: total ? index / total : 0
      };
    }

    function fitFont(weight, baseSize, text, maxWidth) {
      let size = baseSize;
      const family = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI", sans-serif';
      maskContext.font = `${weight} ${size}px ${family}`;
      while (maskContext.measureText(text).width > maxWidth && size > 18) {
        size -= 1;
        maskContext.font = `${weight} ${size}px ${family}`;
      }
      return { font: maskContext.font, size };
    }

    function sampleText(text, options) {
      const { font, centerY, step, maxPoints, fontSize } = options;
      maskCanvas.width = Math.ceil(state.width);
      maskCanvas.height = Math.ceil(state.height);
      maskContext.clearRect(0, 0, state.width, state.height);
      maskContext.fillStyle = '#fff';
      maskContext.font = font;
      maskContext.textAlign = 'center';
      maskContext.textBaseline = 'middle';
      maskContext.fillText(text, state.width * 0.5, centerY);

      const metrics = maskContext.measureText(text);
      const left = clamp(Math.floor(state.width * 0.5 - metrics.width * 0.5 - 8), 0, state.width - 1);
      const right = clamp(Math.ceil(state.width * 0.5 + metrics.width * 0.5 + 8), left + 1, state.width);
      const top = clamp(Math.floor(centerY - fontSize), 0, state.height - 1);
      const bottom = clamp(Math.ceil(centerY + fontSize), top + 1, state.height);
      const image = maskContext.getImageData(left, top, right - left, bottom - top);
      const points = [];
      const sampling = Math.max(2, Math.round(step));

      for (let y = 0; y < image.height; y += sampling) {
        for (let x = 0; x < image.width; x += sampling) {
          if (image.data[(y * image.width + x) * 4 + 3] > 100) {
            points.push({ x: left + x, y: top + y });
          }
        }
      }

      if (points.length <= maxPoints) return points;
      const result = [];
      const stride = points.length / maxPoints;
      for (let index = 0; index < maxPoints; index += 1) {
        result.push(points[Math.floor(index * stride)]);
      }
      return result;
    }

    function normalizePoints(points, count) {
      if (!points.length) {
        return Array.from({ length: count }, () => ({ x: state.width * 0.5, y: state.height * 0.5 }));
      }
      return Array.from({ length: count }, (_, index) => {
        const source = points[Math.floor(index * points.length / count) % points.length];
        return {
          x: source.x + (index % 3 - 1) * 0.12,
          y: source.y + (index % 2 ? 0.08 : -0.08)
        };
      });
    }

    function createTargets() {
      const mobile = state.width < 600;
      const titleSize = clamp(
        state.width * (mobile ? 0.105 : 0.067),
        mobile ? 36 : 48,
        mobile ? 58 : 86
      );
      const subtitleSize = clamp(state.width * (mobile ? 0.043 : 0.021), 15, mobile ? 19 : 25);
      const titleFont = fitFont('700', titleSize, config.title, state.width * 0.88);
      const subtitleFonts = config.subtitles.map((message) => (
        fitFont('500', subtitleSize, message, state.width * 0.9)
      ));
      const titleY = state.height * 0.5 - titleFont.size * 0.47;
      const subtitleY = state.height * 0.5 + titleFont.size * 0.66;
      const title = sampleText(config.title, {
        font: titleFont.font,
        centerY: titleY,
        step: mobile ? 3 : 4,
        maxPoints: mobile ? 1050 : 1450,
        fontSize: titleFont.size
      });
      const subtitleRaw = config.subtitles.map((message, index) => sampleText(message, {
        font: subtitleFonts[index].font,
        centerY: subtitleY,
        step: mobile ? 3 : 3.5,
        maxPoints: mobile ? 650 : 900,
        fontSize: subtitleFonts[index].size
      }));
      const subtitleCount = clamp(
        Math.max(...subtitleRaw.map((points) => points.length)),
        mobile ? 360 : 460,
        mobile ? 620 : 820
      );

      return {
        title,
        subtitles: subtitleRaw.map((points) => normalizePoints(points, subtitleCount))
      };
    }

    function reconcileParticles(previous, points, group) {
      const particles = previous.slice(0, points.length);
      while (particles.length < points.length) {
        particles.push(createParticle(points[particles.length], group, particles.length, points.length));
      }
      particles.forEach((particle, index) => {
        particle.tx = points[index].x;
        particle.ty = points[index].y;
        particle.fromTx = particle.tx;
        particle.fromTy = particle.ty;
        particle.toTx = particle.tx;
        particle.toTy = particle.ty;
      });
      return particles;
    }

    function rebuildTargets(initial) {
      const targets = createTargets();
      if (!initial) {
        const scaleX = state.width / state.oldWidth;
        const scaleY = state.height / state.oldHeight;
        [...state.titleParticles, ...state.subtitleParticles].forEach((particle) => {
          particle.x *= scaleX;
          particle.y *= scaleY;
        });
      }
      state.titleParticles = reconcileParticles(state.titleParticles, targets.title, 'title');
      state.subtitleTargets = targets.subtitles;
      state.subtitleParticles = reconcileParticles(
        state.subtitleParticles,
        targets.subtitles[state.subtitleIndex],
        'subtitle'
      );
      state.morph = null;
      state.oldWidth = state.width;
      state.oldHeight = state.height;
    }

    function createStars() {
      const count = Math.round(clamp(state.width * state.height / 24000, 20, 70));
      state.stars = Array.from({ length: count }, () => ({
        x: random(0, state.width),
        y: random(0, state.height),
        radius: random(0.35, 1.2),
        alpha: random(0.15, 0.5),
        phase: random(0, Math.PI * 2)
      }));
    }

    function resize() {
      if (state.destroyed) return;
      const bounds = host.getBoundingClientRect();
      state.oldWidth = state.width;
      state.oldHeight = state.height;
      state.width = Math.max(1, bounds.width);
      state.height = Math.max(1, bounds.height);
      state.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(state.width * state.ratio);
      canvas.height = Math.round(state.height * state.ratio);
      canvas.style.width = `${state.width}px`;
      canvas.style.height = `${state.height}px`;
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      createStars();
      rebuildTargets(state.titleParticles.length === 0);
    }

    function drawRibbon(time, offset, base, amplitude, thickness, colorA, colorB) {
      const segments = 34;
      const top = [];
      const bottom = [];
      for (let index = 0; index <= segments; index += 1) {
        const x = (index / segments) * state.width;
        const wave = time * 0.00028 + offset + index * 0.32;
        const center = state.height * base
          + Math.sin(wave) * amplitude
          + Math.sin(wave * 0.47 + 1.4) * amplitude * 0.42;
        const depth = thickness + Math.sin(wave * 0.7) * thickness * 0.23;
        top.push([x, center - depth]);
        bottom.unshift([x, center + depth]);
      }
      const gradient = context.createLinearGradient(0, state.height * 0.2, state.width, state.height * 0.85);
      gradient.addColorStop(0, colorA);
      gradient.addColorStop(0.55, colorB);
      gradient.addColorStop(1, 'rgba(7, 19, 22, 0.04)');
      context.beginPath();
      top.concat(bottom).forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.fillStyle = gradient;
      context.fill();
    }

    function drawAurora(time) {
      context.globalCompositeOperation = 'source-over';
      context.fillStyle = '#071316';
      context.fillRect(0, 0, state.width, state.height);
      context.globalCompositeOperation = 'screen';
      drawRibbon(time, 0.2, 0.46, 48, 78, 'rgba(20, 184, 166, 0.48)', 'rgba(45, 212, 191, 0.18)');
      drawRibbon(time * 0.92, 1.65, 0.55, 64, 62, 'rgba(239, 131, 84, 0.3)', 'rgba(132, 204, 22, 0.15)');
      drawRibbon(time * 1.11, 3.05, 0.67, 38, 54, 'rgba(8, 145, 178, 0.28)', 'rgba(94, 234, 212, 0.14)');
      context.globalCompositeOperation = 'source-over';
      state.stars.forEach((star) => {
        const pulse = star.alpha + Math.sin(time * 0.001 + star.phase) * 0.08;
        context.globalAlpha = clamp(pulse, 0.05, 0.6);
        context.fillStyle = '#d8fff7';
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fill();
      });
      context.globalAlpha = 1;
    }

    function updateParticle(particle, targetX, targetY, delta) {
      const spring = particle.group === 'title' ? 0.018 : 0.022;
      particle.vx += (targetX - particle.x) * spring * delta;
      particle.vy += (targetY - particle.y) * spring * delta;
      if (state.pointer.active) {
        const deltaX = particle.x - state.pointer.x;
        const deltaY = particle.y - state.pointer.y;
        const distance = Math.hypot(deltaX, deltaY);
        const radius = state.width < 600 ? 86 : 128;
        if (distance > 0.01 && distance < radius) {
          const force = Math.pow(1 - distance / radius, 2) * 8.5 * delta;
          particle.vx += (deltaX / distance) * force;
          particle.vy += (deltaY / distance) * force;
        }
      }
      particle.vx *= Math.pow(0.84, delta);
      particle.vy *= Math.pow(0.84, delta);
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
    }

    function drawParticles(time, delta) {
      const drawParticle = (particle, targetX, targetY) => {
        updateParticle(particle, targetX, targetY, delta);
        const shimmer = 1 + Math.sin(time * 0.002 + particle.phase) * 0.12;
        const radius = particle.size * shimmer;
        context.globalAlpha = 0.12;
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(particle.x, particle.y, radius * 2.8, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = 0.92;
        context.beginPath();
        context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        context.fill();
      };

      state.titleParticles.forEach((particle) => drawParticle(particle, particle.tx, particle.ty));
      state.subtitleParticles.forEach((particle, index) => {
        let targetX = particle.tx;
        let targetY = particle.ty;
        if (state.morph) {
          const progress = easeInOut(clamp(
            (time - state.morph.startedAt) / state.morph.duration,
            0,
            1
          ));
          targetX = lerp(particle.fromTx, particle.toTx, progress);
          targetY = lerp(particle.fromTy, particle.toTy, progress);
          if (progress >= 1) {
            particle.tx = particle.toTx;
            particle.ty = particle.toTy;
          }
          if (progress >= 1 && index === state.subtitleParticles.length - 1) {
            state.subtitleIndex = state.morph.nextIndex;
            state.morph = null;
            state.nextMorphAt = time + 4300;
            semantics.subtitle.textContent = config.subtitles[state.subtitleIndex];
          }
        }
        drawParticle(particle, targetX, targetY);
      });
      context.globalAlpha = 1;
    }

    function startMorph(time) {
      if (state.morph || reducedMotion.matches || state.subtitleTargets.length < 2) return;
      const nextIndex = (state.subtitleIndex + 1) % state.subtitleTargets.length;
      const nextTargets = state.subtitleTargets[nextIndex];
      state.subtitleParticles.forEach((particle, index) => {
        particle.fromTx = particle.tx;
        particle.fromTy = particle.ty;
        particle.toTx = nextTargets[index].x;
        particle.toTy = nextTargets[index].y;
        particle.vx += random(-1.2, 1.2);
        particle.vy += random(-1.2, 1.2);
      });
      state.morph = { startedAt: time, duration: 1250, nextIndex };
    }

    function render(time) {
      if (state.destroyed || !canvas.isConnected) return;
      const elapsed = state.lastTime ? time - state.lastTime : 16.67;
      const delta = clamp(elapsed / 16.67, 0.35, 2);
      state.lastTime = time;
      drawAurora(reducedMotion.matches ? 0 : time);
      if (!reducedMotion.matches && time >= state.nextMorphAt) startMorph(time);
      drawParticles(time, delta);
      if (!reducedMotion.matches) state.frame = window.requestAnimationFrame(render);
    }

    function updatePointer(event) {
      const bounds = host.getBoundingClientRect();
      state.pointer.x = event.clientX - bounds.left;
      state.pointer.y = event.clientY - bounds.top;
      state.pointer.active = true;
    }

    function resume() {
      if (state.destroyed || document.hidden || reducedMotion.matches) return;
      window.cancelAnimationFrame(state.frame);
      state.lastTime = performance.now();
      state.frame = window.requestAnimationFrame(render);
    }

    host.addEventListener('pointermove', updatePointer, { passive: true, signal: abortController.signal });
    host.addEventListener('pointerleave', () => { state.pointer.active = false; }, {
      passive: true,
      signal: abortController.signal
    });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.cancelAnimationFrame(state.frame);
      else resume();
    }, { signal: abortController.signal });
    reducedMotion.addEventListener('change', () => {
      window.cancelAnimationFrame(state.frame);
      if (reducedMotion.matches) {
        drawAurora(0);
        drawParticles(0, 1);
      } else {
        resume();
      }
    }, { signal: abortController.signal });

    const start = () => {
      if (state.destroyed) return;
      resize();
      state.nextMorphAt = performance.now() + 4200;
      state.lastTime = performance.now();
      if (reducedMotion.matches) render(0);
      else state.frame = window.requestAnimationFrame(render);
    };

    const fontReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontReady.catch(() => {}).then(start);

    return {
      host,
      destroy() {
        state.destroyed = true;
        window.cancelAnimationFrame(state.frame);
        resizeObserver.disconnect();
        abortController.abort();
        canvas.remove();
        semantics.semantic.remove();
        semantics.fallback.remove();
      }
    };
  }

  function refresh() {
    const host = document.querySelector('.home-banner-container');
    const config = getParticleConfig();
    if (!host) {
      if (heroController) heroController.destroy();
      heroController = null;
      enableSpotlightCards();
      return;
    }
    if (!heroController || heroController.host !== host || !host.isConnected) {
      if (heroController) heroController.destroy();
      heroController = mountParticleHero(host, config);
    }
    enableSpotlightCards();
  }

  window.__chenyipingEnhancements = { refresh };
  document.addEventListener('swup:contentReplaced', refresh);
  document.addEventListener('swup:page:view', refresh);
  refresh();
}());
