(() => {
  const canvas = document.getElementById("life-knot");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const U = 96;
  const V = 22;
  const tubeRadius = 0.32;
  const cells = new Uint8Array(U * V);
  const next = new Uint8Array(U * V);
  const points = Array.from({ length: U }, () => Array(V));
  const quads = [];
  let generation = 0;
  let lastStep = 0;
  let rotationY = -0.28;
  let rotationX = -0.66;
  let velocityY = 0.0018;
  let velocityX = 0;
  let isDragging = false;
  let dragX = 0;
  let dragY = 0;
  let lastTime = 0;
  let lastPopulation = 0;
  let stagnantTicks = 0;

  const idx = (u, v) => ((u + U) % U) * V + ((v + V) % V);

  function seed() {
    for (let u = 0; u < U; u += 1) {
      for (let v = 0; v < V; v += 1) {
        const ribbon = Math.abs(((v - u * 0.21) % V + V) % V - V / 2) < 1.35;
        const spark = Math.random() > 0.82;
        cells[idx(u, v)] = ribbon || spark ? 1 : 0;
      }
    }

    const gliders = [
      [8, 4],
      [36, 15],
      [76, 8],
      [94, 20],
    ];
    for (const [u, v] of gliders) injectGlider(u, v);
    lastPopulation = 0;
    stagnantTicks = 0;
  }

  function injectGlider(u, v) {
    const pattern = [
      [1, 0],
      [2, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    for (const [du, dv] of pattern) cells[idx(u + du, v + dv)] = 1;
  }

  function injectMethuselah(u, v) {
    const pattern = [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ];
    for (const [du, dv] of pattern) cells[idx(u + du, v + dv)] = 1;
  }

  function countPopulation() {
    let population = 0;
    for (let i = 0; i < cells.length; i += 1) population += cells[i];
    return population;
  }

  function sustainActivity() {
    const population = countPopulation();
    const delta = Math.abs(population - lastPopulation);
    stagnantTicks = delta < 7 ? stagnantTicks + 1 : 0;
    lastPopulation = population;

    if (generation % 36 === 0 || population < 90 || stagnantTicks > 18) {
      const u = (generation * 17 + Math.floor(Math.random() * 11)) % U;
      const v = (generation * 7 + Math.floor(Math.random() * 5)) % V;
      injectGlider(u, v);
      injectMethuselah(u + 9, v + 5);
      stagnantTicks = 0;
    }

    if (population > U * V * 0.48) {
      for (let i = 0; i < cells.length; i += 1) {
        if (cells[i] && Math.random() < 0.16) cells[i] = 0;
      }
    }
  }

  function stepLife() {
    for (let u = 0; u < U; u += 1) {
      for (let v = 0; v < V; v += 1) {
        let n = 0;
        for (let du = -1; du <= 1; du += 1) {
          for (let dv = -1; dv <= 1; dv += 1) {
            if (du || dv) n += cells[idx(u + du, v + dv)];
          }
        }
        const alive = cells[idx(u, v)] === 1;
        next[idx(u, v)] = alive ? (n === 2 || n === 3 ? 1 : 0) : n === 3 ? 1 : 0;
      }
    }
    cells.set(next);
    generation += 1;
    sustainActivity();
  }

  function trefoil(t) {
    const x = Math.sin(t) + 2 * Math.sin(2 * t);
    const y = Math.cos(t) - 2 * Math.cos(2 * t);
    const z = -Math.sin(3 * t);
    return [x, y, z];
  }

  function normalize(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }

  function rotate([x, y, z], ay, ax) {
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const y1 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;
    return [x1, y1, z2];
  }

  function project([x, y, z], w, h) {
    const depth = 8.3;
    const scale = Math.min(w, h) * 0.137;
    const p = scale / (z + depth);
    return [w / 2 + x * p * depth, h / 2 + y * p * depth, z];
  }

  function buildSurface(time, w, h) {
    const ay = rotationY;
    const ax = rotationX + Math.sin(time * 0.00018) * 0.025;
    quads.length = 0;

    for (let u = 0; u < U; u += 1) {
      const t = (u / U) * Math.PI * 2;
      const c = trefoil(t);
      const c2 = trefoil(t + 0.015);
      const tangent = normalize([c2[0] - c[0], c2[1] - c[1], c2[2] - c[2]]);
      const provisional = normalize(cross(tangent, [0, 0, 1]));
      const normal = Math.hypot(...provisional) < 0.05 ? [1, 0, 0] : provisional;
      const binormal = normalize(cross(tangent, normal));

      for (let v = 0; v < V; v += 1) {
        const a = (v / V) * Math.PI * 2;
        const twist = t * 1.5;
        const ca = Math.cos(a + twist);
        const sa = Math.sin(a + twist);
        const p = [
          c[0] + tubeRadius * (normal[0] * ca + binormal[0] * sa),
          c[1] + tubeRadius * (normal[1] * ca + binormal[1] * sa),
          c[2] + tubeRadius * (normal[2] * ca + binormal[2] * sa),
        ];
        points[u][v] = project(rotate(p, ay, ax), w, h);
      }
    }

    for (let u = 0; u < U; u += 1) {
      for (let v = 0; v < V; v += 1) {
        const p0 = points[u][v];
        const p1 = points[(u + 1) % U][v];
        const p2 = points[(u + 1) % U][(v + 1) % V];
        const p3 = points[u][(v + 1) % V];
        const z = (p0[2] + p1[2] + p2[2] + p3[2]) / 4;
        quads.push({ u, v, z, live: cells[idx(u, v)], pts: [p0, p1, p2, p3] });
      }
    }
    quads.sort((a, b) => a.z - b.z);
  }

  function draw(time) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (time - lastStep > 185) {
      stepLife();
      lastStep = time;
    }

    ctx.clearRect(0, 0, w, h);
    const dt = Math.min(32, Math.max(0, time - lastTime || 16));
    lastTime = time;
    if (!isDragging) {
      rotationY += velocityY * dt;
      rotationX += velocityX * dt;
      velocityY *= 0.992;
      velocityX *= 0.988;
      if (Math.abs(velocityY) < 0.00055) velocityY = 0.00055;
    }
    rotationX = Math.max(-1.35, Math.min(1.05, rotationX));

    ctx.fillStyle = "#fbfcfa";
    ctx.fillRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.min(w, h) * 0.62);
    bg.addColorStop(0, "rgba(116, 217, 0, 0.09)");
    bg.addColorStop(0.45, "rgba(255, 255, 255, 0)");
    bg.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    buildSurface(time, w, h);

    for (const q of quads) {
      const shade = Math.max(0, Math.min(1, (q.z + 3.6) / 7.2));
      const liveAlpha = 0.52 + shade * 0.42;
      ctx.beginPath();
      ctx.moveTo(q.pts[0][0], q.pts[0][1]);
      for (let i = 1; i < 4; i += 1) ctx.lineTo(q.pts[i][0], q.pts[i][1]);
      ctx.closePath();
      if (q.live) {
        ctx.fillStyle = `rgba(116, 217, 0, ${liveAlpha})`;
        ctx.fill();
      } else if ((q.u % 6 === 0 && q.v % 4 === 0) || q.v === 0) {
        ctx.fillStyle = `rgba(16, 18, 15, ${0.026 + shade * 0.034})`;
        ctx.fill();
      }
      if (q.live || q.v === 0 || q.v === Math.floor(V / 2) || q.u % 4 === 0 || q.v % 4 === 0) {
        const majorLine = q.v === 0 || q.v === Math.floor(V / 2) || q.u % 8 === 0;
        ctx.strokeStyle = q.live
          ? `rgba(16, 18, 15, ${0.26 + shade * 0.34})`
          : `rgba(16, 18, 15, ${majorLine ? 0.16 + shade * 0.08 : 0.075 + shade * 0.055})`;
        ctx.lineWidth = q.live ? 0.92 * dpr : (majorLine ? 0.74 : 0.48) * dpr;
        ctx.stroke();
      }
    }

    ctx.fillStyle = "rgba(16, 18, 15, 0.68)";
    ctx.font = `${11 * dpr}px SFMono-Regular, Consolas, monospace`;
    ctx.fillText(`generation ${generation.toString().padStart(4, "0")}`, 20 * dpr, (h - 22 * dpr));
    requestAnimationFrame(draw);
  }

  function getPoint(event) {
    const touch = event.touches?.[0] || event.changedTouches?.[0];
    return touch || event;
  }

  function startDrag(event) {
    const p = getPoint(event);
    isDragging = true;
    dragX = p.clientX;
    dragY = p.clientY;
    velocityX = 0;
    velocityY = 0;
    canvas.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!isDragging) return;
    event.preventDefault();
    const p = getPoint(event);
    const dx = p.clientX - dragX;
    const dy = p.clientY - dragY;
    dragX = p.clientX;
    dragY = p.clientY;
    const gain = 0.008;
    rotationY += dx * gain;
    rotationX += dy * gain;
    velocityY = dx * 0.00028;
    velocityX = dy * 0.00024;
  }

  function endDrag(event) {
    isDragging = false;
    canvas.releasePointerCapture?.(event.pointerId);
  }

  canvas.addEventListener("pointerdown", startDrag);
  canvas.addEventListener("pointermove", moveDrag);
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("dblclick", () => {
    cells.fill(0);
    generation = 0;
    seed();
  });

  seed();
  requestAnimationFrame(draw);
})();
