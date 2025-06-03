// mouseNeon.js – Wraithveil Neon Mouse Trail & Orb Effect (Vanilla JS)
// (24 particles, immediate trail clear, faster return)

(function(global) {
  // —————————————————————————————————————
  // CORE STATE & CONSTANTS
  // —————————————————————————————————————
  let canvas, ctx, animationId;
  let mouseTrail = [], orbParticles = [];
  let lastMoveTime = 0;
  const ORB_PARTICLE_COUNT = 24;

  let mouseOrb = {
    x: -1000, y: -1000,
    px: -1000, py: -1000,
    exploded: false, explodeTime: 0,
    grow: 1, squash: 0, squashTimer: 0, squashActive: false,
    bounce: 0, bounceTime: 0,
    reassembleTimestamps: [], reassembledParticles: 0,
    afterglow: 0, afterglowTime: 0
  };

  // —————————————————————————————————————
  // UTILITY FUNCTIONS
  // —————————————————————————————————————
  function getParticleGradientColor(lifeProgress) {
    const hue = 24 + (240 - 24) * lifeProgress;
    const sat = 92 - 12 * lifeProgress;
    const lum = 54 + 18 * lifeProgress;
    return `hsl(${hue},${sat}%,${lum}%)`;
  }

  function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
  }

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // —————————————————————————————————————
  // DRAW: NEON MOUSE TRAIL
  // —————————————————————————————————————
  function drawNeonMouseTrail(ctx, mouseTrail, now, brighten = 0, afterglow = 0) {
    if (mouseTrail.length < 2) return;
    ctx.save();
    for (let i = 1; i < mouseTrail.length; i++) {
      const pt1 = mouseTrail[i - 1];
      const pt2 = mouseTrail[i];
      const age = Math.max(0, Math.min(1, (now - pt2.t) / 200));
      const width = 6 * (1 - age) + 1.5 * age + 3 * afterglow;
      const baseAlpha = 0.36 * (1 - age) + 0.10 * age + 0.22 * afterglow;
      const hue = pt2.hue + afterglow * 90 * (1 - age);
      const earlyHot = Math.max(0, 0.6 - age * 1.15);
      const alpha = baseAlpha + (brighten * 0.32 + earlyHot * 0.55) * (1 - age);
      const shadowAlpha = 0.85 * baseAlpha
        + (brighten * 0.35 + earlyHot * 0.38) * (1 - age)
        + 0.26 * afterglow;
      ctx.strokeStyle = `hsla(${hue},100%,78%,${alpha})`;
      ctx.shadowColor = `hsla(${hue + 25 * afterglow},100%,92%,${shadowAlpha})`;
      ctx.shadowBlur = 14 + 28 * (brighten + earlyHot + afterglow * 1.2);
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // —————————————————————————————————————
  // DRAW: PARTICLE TRAIL
  // —————————————————————————————————————
  function drawParticleTrail(ctx, p, afterglow = 0) {
    if (p.trail && p.trail.length > 1) {
      for (let j = 1; j < p.trail.length; j++) {
        const prev = p.trail[j - 1];
        const curr = p.trail[j];
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(curr.x, curr.y);
        const age = j / p.trail.length;
        const alpha = 0.15 * age + 0.19 * afterglow * (1 - age);
        ctx.strokeStyle = `hsla(${p.hue},100%,85%,${alpha})`;
        ctx.shadowColor = `hsla(${p.hue},100%,100%,${alpha * 0.4 + 0.3 * afterglow})`;
        ctx.shadowBlur = 4 + 11 * afterglow;
        ctx.lineWidth = 0.8 + 2 * (1 - age) + 1.1 * afterglow;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function getOrbGlowFactor() {
    const fraction = mouseOrb.reassembledParticles / ORB_PARTICLE_COUNT;
    let bounce = 0;
    if (mouseOrb.bounce > 0 && mouseOrb.bounceTime) {
      const now = performance.now();
      const bounceElapsed = now - mouseOrb.bounceTime;
      if (bounceElapsed < 500) {
        bounce = 0.35 * Math.sin(Math.PI * (bounceElapsed / 500));
      }
    }
    const afterglow = mouseOrb.afterglow;
    return Math.max(fraction, bounce, afterglow);
  }

  // —————————————————————————————————————
  // CLEAR STALE TRAIL POINTS
  // —————————————————————————————————————
  function cleanMouseTrail(now) {
    // If no movement in past 50 ms → clear entirely
    if (now - lastMoveTime > 50) {
      mouseTrail = [];
      return;
    }
    // Otherwise remove points older than 200 ms
    while (mouseTrail.length > 0 && (now - mouseTrail[0].t) > 200) {
      mouseTrail.shift();
    }
  }
  // —————————————————————————————————————
  // MAIN ANIMATION LOOP
  // —————————————————————————————————————
  function animate() {
    // 1) Clear canvas and set composite for glowing effect
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    const now = performance.now();

      let reassembledCount = 0;

    // 2) Compute afterglow for orb reassembly
    let afterglow = 0;
    if (mouseOrb.afterglowTime > 0) {
      const t = (now - mouseOrb.afterglowTime) / 1500;
      if (t < 1) {
        afterglow = easeOutQuint(1 - t);
      } else {
        mouseOrb.afterglowTime = 0;
      }
    }

    // 3) Brighten trail if some particles have reassembled
    let brightenTrail = 0;
    if (mouseOrb.reassembledParticles > 0) {
      brightenTrail = mouseOrb.reassembledParticles / ORB_PARTICLE_COUNT;
    }

    // 4) Draw neon mouse trail (and clear if no recent movement)
    cleanMouseTrail(now);
    drawNeonMouseTrail(ctx, mouseTrail, now, brightenTrail, afterglow);

    // 5) Handle explosion → return for each particle
    if (mouseOrb.exploded && orbParticles.length) {
      for (let i = orbParticles.length - 1; i >= 0; i--) {
        const p = orbParticles[i];
        p.trail = p.trail || [];
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 25) p.trail.shift();

        if (typeof p.reentryDelay === 'undefined') {
          p.reentryDelay = 440 + i * 56 + Math.random() * 140;
        }

        const particleExplodeElapsed = now - mouseOrb.explodeTime;
        const lifeRatio = Math.max(0, 1 - (particleExplodeElapsed / 1700));
        const swirlElapsed = Math.max(0, particleExplodeElapsed - 500);
        const lifeProgress = Math.min(
          1,
          Math.max(
            0,
            (particleExplodeElapsed - p.reentryDelay + 260) /
              (1700 - p.reentryDelay + 260)
          )
        );

        if (particleExplodeElapsed < p.reentryDelay) {
          // ─── EXPLOSION PHASE ───
          p.x += p.vx * 0.98;
          p.y += p.vy * 0.98;
          p.vx *= 0.96;
          p.vy *= 0.96;
        } else {
          // ─── RETURN PHASE ───

          // 1) Time since return started
          const returnStart = mouseOrb.explodeTime + p.reentryDelay;
          const timeSinceReturn = Math.max(0, now - returnStart);

          // 2) Vector toward orb center
          const dx = mouseOrb.x - p.x;
          const dy = mouseOrb.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) + 0.1;

          // 3) Swirl component
          const swirlStrength = 0.52 * Math.exp(
            - (particleExplodeElapsed - p.reentryDelay) / 400
          );
          const swirlAngle = Math.atan2(dy, dx) + Math.PI / 2;
          const swirlVx = Math.cos(swirlAngle) * swirlStrength * (0.93 + 0.17 * Math.random());
          const swirlVy = Math.sin(swirlAngle) * swirlStrength * (0.93 + 0.17 * Math.random());

          // 4) Base force toward center
          const baseForce = 0.44;
          const ax = (dx / dist) * baseForce
                    + swirlVx
                    + (Math.random() - 0.5) * 0.12;
          const ay = (dy / dist) * baseForce
                    + swirlVy
                    + (Math.random() - 0.5) * 0.12;

          // 5) lifeProgress ∈ [0,1]
          //    (already computed above)

          // 6) Ramp multiplier: 3 → 5 as lifeProgress → 1
          const BASE_MULTIPLIER = 3.0;
          const speedRamp = BASE_MULTIPLIER + (lifeProgress * 2);

          // 7) timeBoost: 1 → 1.5 over first 400 ms
          const timeBoost = 1 + Math.min(timeSinceReturn / 400, 0.5);

          // 8) Apply acceleration
          p.vx += ax * speedRamp * timeBoost;
          p.vy += ay * speedRamp * timeBoost;

          // 9) Damping
          p.vx *= 0.88;
          p.vy *= 0.88;

          // 10) Update position
          p.x += p.vx;
          p.y += p.vy;

          // 11) Reassemble if close enough
          if (dist < 8) {
            orbParticles.splice(i, 1);
            mouseOrb.reassembleTimestamps.push(now);
            mouseOrb.reassembledParticles++;
            mouseOrb.squashActive = true;
            mouseOrb.squashTimer = now;
            p.justReassembled = true;
            continue;
          }
        }

        // ─── DRAW PARTICLE + ITS TRAIL ───
        drawParticleTrail(ctx, p, afterglow);
        ctx.save();
        ctx.beginPath();

        const baseR = 2.2 + 2.3 * afterglow;
        let flash = 0;
        const dx2 = mouseOrb.x - p.x;
        const dy2 = mouseOrb.y - p.y;
        const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        const gradColor = getParticleGradientColor(lifeProgress);

        if (particleExplodeElapsed < p.reentryDelay + 260) {
          flash = 1 - (particleExplodeElapsed - p.reentryDelay) / 260;
        }
        if (p.justReassembled && dist2 < 15) {
          flash = 1;
          setTimeout(() => { p.justReassembled = false; }, 80);
        }
        if (dist2 < 26) {
          flash += (1 - dist2 / 26) * 0.5;
        }
        if (flash > 1) flash = 1;

        const radius = baseR * (0.75 * lifeRatio + 0.49 * flash);
        ctx.arc(p.x, p.y, Math.max(0.69, radius), 0, 2 * Math.PI);
        ctx.fillStyle = gradColor;
        ctx.shadowColor = gradColor;
        ctx.shadowBlur = 21 * (0.19 + flash + afterglow * 0.7);
        ctx.globalAlpha = 0.75 + 0.49 * flash + 0.17 * afterglow;
        ctx.fill();
        ctx.restore();
      }

      // After looping, update reassembly & orb growth
      reassembledCount = mouseOrb.reassembleTimestamps.length;
      if (reassembledCount > ORB_PARTICLE_COUNT) {
        mouseOrb.reassembleTimestamps = mouseOrb.reassembleTimestamps.slice(-ORB_PARTICLE_COUNT);
      }
      if (reassembledCount > 0) {
        const minT = mouseOrb.reassembleTimestamps[0];
        const elapsedSinceFirst = now - minT;
        const particleFraction = reassembledCount / ORB_PARTICLE_COUNT;
        const linger = Math.max(0, 1.15 - elapsedSinceFirst / 4300);
        const growTarget = 1 + 0.48 * easeOutQuint(particleFraction) * linger;
        if (mouseOrb.grow < growTarget) mouseOrb.grow += 0.006;
        else if (mouseOrb.grow > growTarget) mouseOrb.grow -= 0.0045;
      }
      if (!orbParticles.length) {
        mouseOrb.exploded = false;
        mouseOrb.bounce = 1;
        mouseOrb.bounceTime = performance.now();
        mouseOrb.afterglow = 1;
        mouseOrb.afterglowTime = performance.now();
        mouseOrb.squashActive = false;
        mouseOrb.squash = 0;
        mouseOrb.reassembleTimestamps = [];
        mouseOrb.reassembledParticles = 0;
      }
    }

    // 6) Handle orb squash & bounce
    if (mouseOrb.squashActive && mouseOrb.reassembledParticles > 0) {
      const squashProgress = Math.min(1, mouseOrb.reassembledParticles / ORB_PARTICLE_COUNT);
      mouseOrb.squash = 0.98 * Math.exp(-0.16 * squashProgress) * (1 - 0.41 * squashProgress);
    } else if (!mouseOrb.exploded) {
      mouseOrb.squash = 0;
      mouseOrb.squashTimer = 0;
      mouseOrb.squashActive = false;
      mouseOrb.reassembledParticles = 0;
    }

    // 7) Draw the orb at mouse location
    const orbHue = (now / 6) % 360;
    ctx.save();
    let squash = 1;
    const growVal = mouseOrb.grow || 1;
    const glowVal = getOrbGlowFactor();
    let bounce = 0;
    if (mouseOrb.bounce > 0 && mouseOrb.bounceTime) {
      const bounceElapsed = now - mouseOrb.bounceTime;
      if (bounceElapsed < 500) {
        bounce = 0.33 * Math.sin(Math.PI * (bounceElapsed / 500));
      } else {
        mouseOrb.bounce = 0;
        mouseOrb.bounceTime = 0;
      }
    }
    if (mouseOrb.squash > 0.01) {
      squash = 1 - 0.35 * mouseOrb.squash;
    }
    squash *= (1 + bounce + 0.08 * afterglow);
    const maxR = 14, minR = 2;
    const outerR = (minR + (maxR - minR) * growVal) * squash;
    const innerR = (0.4 * minR + (6 - 0.4 * minR) * growVal) * squash;
    if ((!mouseOrb.exploded || afterglow > 0.01) && mouseOrb.x >= 0 && mouseOrb.y >= 0) {
      ctx.beginPath();
      ctx.arc(mouseOrb.x, mouseOrb.y, outerR, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(${orbHue},100%,70%,${0.21 + 0.41 * (glowVal + afterglow * 1.2)})`;
      ctx.shadowColor = `hsla(${orbHue},100%,82%,${0.99 * (glowVal + afterglow * 1.15)})`;
      ctx.shadowBlur = 36 * growVal * (1 + glowVal * 1.7 + afterglow * 1.13);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mouseOrb.x, mouseOrb.y, innerR, 0, 2 * Math.PI);
      ctx.fillStyle = `hsla(${orbHue},100%,99%,${0.63 + 0.37 * (glowVal + afterglow)})`;
      ctx.shadowBlur = 9 * growVal * (1 + glowVal * 1.7 + afterglow * 1.25);
      ctx.fill();
    }
    ctx.restore();

    if (!mouseOrb.bounce && !mouseOrb.squash && mouseOrb.grow > 1) mouseOrb.grow -= 0.012;
    if (mouseOrb.grow < 1) mouseOrb.grow = 1;

    // 8) Loop
    ctx.globalCompositeOperation = 'source-over';
    animationId = requestAnimationFrame(animate);
  }

  // —————————————————————————————————————
  // EVENT LISTENERS & HANDLERS
  // —————————————————————————————————————
  function addListeners() {
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', mousemoveHandler);
    window.addEventListener('mouseleave', mouseleaveHandler);
    window.addEventListener('mouseenter', mouseenterHandler);
    window.addEventListener('click', clickHandler);
  }

  function removeListeners() {
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('mousemove', mousemoveHandler);
    window.removeEventListener('mouseleave', mouseleaveHandler);
    window.removeEventListener('mouseenter', mouseenterHandler);
    window.removeEventListener('click', clickHandler);
  }

  function mousemoveHandler(e) {
    const now = performance.now();
    const hue = (now / 10) % 360;
    mouseTrail.push({ x: e.clientX, y: e.clientY, hue, t: now });
    mouseOrb.x = e.clientX;
    mouseOrb.y = e.clientY;
    lastMoveTime = now;
    cleanMouseTrail(now);
  }

  function mouseleaveHandler() {
    mouseTrail = [];
    mouseOrb.x = -1000;
    mouseOrb.y = -1000;
  }

  function mouseenterHandler(e) {
    mouseOrb.x = e.clientX;
    mouseOrb.y = e.clientY;
    lastMoveTime = performance.now();
  }

  function clickHandler(e) {
    mouseOrb.px = e.clientX;
    mouseOrb.py = e.clientY;
    mouseOrb.exploded = true;
    mouseOrb.explodeTime = performance.now();
    mouseOrb.grow = 1;
    mouseOrb.squash = 0;
    mouseOrb.squashActive = false;
    mouseOrb.squashTimer = 0;
    mouseOrb.reassembleTimestamps = [];
    mouseOrb.reassembledParticles = 0;
    mouseOrb.bounce = 0;
    mouseOrb.bounceTime = 0;
    mouseOrb.afterglow = 0;
    mouseOrb.afterglowTime = 0;
    orbParticles = [];
    const orbHue = ((performance.now() / 6) % 360) | 0;
    for (let i = 0; i < ORB_PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 5 + Math.random() * 5;
      const hue = orbHue + Math.random() * 100 - 50;
      orbParticles.push({
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        hue,
        trail: [],
        reentryDelay: undefined,
        justReassembled: false
      });
    }
    // Clear any lingering trail
    mouseTrail = [];
  }

  // —————————————————————————————————————
  // INITIALIZE / DESTROY
  // —————————————————————————————————————
  function initNeonMouseEffect(options = {}) {
    if (canvas) return; // already running
    canvas = options.canvas || document.createElement('canvas');
    canvas.id = 'trailCanvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.zIndex = options.zIndex || '9999';
    canvas.style.pointerEvents = options.pointerEvents || 'none';
    canvas.style.userSelect = 'none';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resizeCanvas();
    addListeners();
    animationId = requestAnimationFrame(animate);
  }

  function destroyNeonMouseEffect() {
    if (animationId) cancelAnimationFrame(animationId);
    removeListeners();
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
    }
    mouseTrail = [];
    orbParticles = [];
    lastMoveTime = 0;
    Object.keys(mouseOrb).forEach(k => {
      if (typeof mouseOrb[k] === 'number') mouseOrb[k] = 0;
      else if (Array.isArray(mouseOrb[k])) mouseOrb[k] = [];
      else mouseOrb[k] = null;
    });
  }

  // Expose globally
  global.initNeonMouseEffect = initNeonMouseEffect;
  global.destroyNeonMouseEffect = destroyNeonMouseEffect;

})(window);
