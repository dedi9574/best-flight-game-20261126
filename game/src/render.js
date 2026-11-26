// Merpati Express — all canvas drawing: terrain, aircraft, rings, HUD and
// screens. Everything is drawn in code; there are no image assets.

import { WORLD, PHYSICS } from './config.js';
import { clamp, radToHeading } from './random.js';
import { ISLANDS, MOUNTAINS, LAKE, CITY, TREES, CLOUDS, BIRDS, isWater } from './world.js';

export const CAMERA_SCALE = 0.62; // world units -> screen pixels

function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function drawBlob(ctx, points, fill) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawScaledBlob(ctx, blob, scale, cx, cy, fill) {
  ctx.beginPath();
  blob.points.forEach((p, i) => {
    const x = cx + (p.x - cx) * scale;
    const y = cy + (p.y - cy) * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Draw the ocean, islands, lake, city, runway, mountains and trees. */
export function drawTerrain(ctx, view, night) {
  const { x0, y0, x1, y1 } = view;
  // Ocean.
  const ocean = ctx.createLinearGradient(0, y0, 0, y1);
  ocean.addColorStop(0, night ? '#0a1a2e' : '#1d6fb8');
  ocean.addColorStop(1, night ? '#081222' : '#2f8fd0');
  ctx.fillStyle = ocean;
  ctx.fillRect(x0 - 40, y0 - 40, x1 - x0 + 80, y1 - y0 + 80);

  // Islands: sand rim, then grass.
  for (const island of ISLANDS) {
    drawScaledBlob(ctx, island, 1.07, island.cx, island.cy, night ? '#4a4030' : '#e8d28a');
    drawBlob(ctx, island.points, night ? '#1d3a24' : '#5fae4e');
    // A lighter green patchwork on the main island.
    if (island === ISLANDS[0]) {
      ctx.fillStyle = night ? '#22482a' : '#6fbf5e';
      ctx.beginPath();
      ctx.ellipse(3300, 4300, 900, 600, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(5200, 3000, 700, 450, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Lake.
  ctx.fillStyle = night ? '#0d2438' : '#3f9fd8';
  ctx.beginPath();
  ctx.ellipse(LAKE.cx, LAKE.cy, LAKE.rx, LAKE.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // River from the lake to the south coast.
  ctx.strokeStyle = night ? '#0d2438' : '#3f9fd8';
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(LAKE.cx + 200, LAKE.cy + 300);
  ctx.bezierCurveTo(3300, 5400, 3600, 5600, 3500, 5900);
  ctx.stroke();

  // City: streets first, then building blocks.
  ctx.fillStyle = night ? '#2a2f38' : '#8d9299';
  ctx.fillRect(CITY.x0, CITY.y0, CITY.x1 - CITY.x0, CITY.y1 - CITY.y0);
  const bw = 118, bh = 96, gap = 34;
  for (let bx = CITY.x0 + gap; bx + bw < CITY.x1; bx += bw + gap) {
    for (let by = CITY.y0 + gap; by + bh < CITY.y1; by += bh + gap) {
      const h = hash2(bx, by);
      ctx.fillStyle = night
        ? h > 0.5 ? '#3d4450' : '#343a44'
        : h > 0.66 ? '#c9a86a' : h > 0.33 ? '#aab4c0' : '#7f8ea0';
      ctx.fillRect(bx, by, bw, bh);
      // Lit windows at night.
      if (night && h > 0.4) {
        ctx.fillStyle = 'rgba(255, 214, 120, 0.85)';
        ctx.fillRect(bx + 12, by + 12, 10, 8);
        ctx.fillRect(bx + bw - 26, by + bh - 22, 10, 8);
      }
    }
  }
  // Main road from the city down to the runway.
  ctx.strokeStyle = night ? '#3a3f47' : '#5c5c5c';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(5400, CITY.y1);
  ctx.lineTo(5400, WORLD.runway.y);
  ctx.stroke();

  drawRunway(ctx, night);

  // Mountains: shaded cones drawn as topographic contours with a pale peak.
  for (const m of MOUNTAINS) {
    ctx.fillStyle = night ? '#3d3226' : '#8a6a44';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = night ? 'rgba(0,0,0,0.35)' : 'rgba(60,40,20,0.4)';
    ctx.lineWidth = 7;
    for (const f of [0.72, 0.48]) {
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = night ? '#6b6258' : '#ece4d2';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    // Height label, only when the peak is well inside the view.
    if (m.x > x0 + 120 && m.x < x1 - 120 && m.y > y0 + 80 && m.y < y1 - 80) {
      ctx.fillStyle = night ? '#c9b8a0' : '#fff';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${m.height} ft`, m.x, m.y + m.r + 34);
    }
  }

  // Trees.
  ctx.fillStyle = night ? '#16301c' : '#2f7d32';
  for (const t of TREES) {
    if (t.x < x0 - 40 || t.x > x1 + 40 || t.y < y0 - 40 || t.y > y1 + 40) continue;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A few boats at sea.
  ctx.fillStyle = '#fff';
  for (const [bx, by] of [[2100, 1500], [6800, 900], [1500, 4200], [8200, 3400]]) {
    ctx.beginPath();
    ctx.ellipse(bx, by, 26, 10, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRunway(ctx, night) {
  const r = WORLD.runway;
  const x = r.x - r.length / 2, y = r.y - r.width / 2;
  ctx.fillStyle = night ? '#23262c' : '#3a3f46';
  ctx.fillRect(x, y, r.length, r.width);
  // Edge lights.
  ctx.fillStyle = night ? '#ffd76e' : '#f5f0dc';
  for (let lx = x + 40; lx < x + r.length; lx += 160) {
    ctx.fillRect(lx, y - 6, 10, 6);
    ctx.fillRect(lx, y + r.width, 10, 6);
  }
  // Centreline dashes and threshold bars.
  ctx.fillStyle = '#fff';
  for (let lx = x + 300; lx < x + r.length - 120; lx += 150) {
    ctx.fillRect(lx, r.y - 5, 80, 10);
  }
  ctx.fillRect(x + 30, y + 14, 60, r.width - 28);
  ctx.fillRect(x + r.length - 90, y + 14, 60, r.width - 28);
  // Designator, clear of the dashes.
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText('09', x + 190, r.y + 22);
}

/** The target rings: the next one glows, passed ones are dim, later ones faint. */
export function drawRings(ctx, rings, ringIndex, time) {
  rings.forEach((ring, i) => {
    const isNext = i === ringIndex;
    const done = i < ringIndex;
    const pulse = isNext ? 1 + Math.sin(time * 4) * 0.12 : 1;
    const radius = 150 * pulse;
    ctx.lineWidth = isNext ? 10 : 6;
    ctx.strokeStyle = done ? 'rgba(120, 200, 120, 0.45)' : isNext ? '#39ff88' : 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = done ? 'rgba(120, 200, 120, 0.18)' : isNext ? 'rgba(57, 255, 136, 0.16)' : 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, radius, 0, Math.PI * 2);
    ctx.fill();
    // Inner ring and number.
    ctx.lineWidth = 3;
    ctx.strokeStyle = done ? 'rgba(120, 200, 120, 0.5)' : isNext ? '#baffdb' : 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = done ? 'rgba(200,255,210,0.8)' : '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), ring.x, ring.y + 16);
    // Target altitude label.
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillStyle = isNext ? '#baffdb' : 'rgba(255,255,255,0.75)';
    ctx.fillText(`${ring.alt} ft`, ring.x, ring.y - radius - 18);
  });
}

/** Drifting clouds in world space. */
export function drawClouds(ctx, time, night) {
  ctx.fillStyle = night ? 'rgba(30, 38, 52, 0.8)' : 'rgba(255, 255, 255, 0.8)';
  for (const c of CLOUDS) {
    const x = ((c.x + c.speed * time) % 9800) - 400;
    ctx.beginPath();
    ctx.ellipse(x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.ellipse(x - c.rx * 0.55, c.y + c.ry * 0.45, c.rx * 0.55, c.ry * 0.62, 0, 0, Math.PI * 2);
    ctx.ellipse(x + c.rx * 0.6, c.y + c.ry * 0.4, c.rx * 0.5, c.ry * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBirds(ctx, time) {
  ctx.strokeStyle = 'rgba(40, 40, 40, 0.8)';
  ctx.lineWidth = 3;
  for (const b of BIRDS) {
    const x = ((b.x + b.speed * time) % 9000);
    const flap = Math.sin(time * 6 + b.x) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 12, b.y + flap);
    ctx.quadraticCurveTo(x, b.y - 6, x + 12, b.y + flap);
    ctx.stroke();
  }
}

/** The plane's shadow on the ground, shrinking and fading with altitude. */
export function drawPlaneShadow(ctx, plane) {
  const k = clamp(1 - plane.altitude / 3000, 0.25, 1);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.28 * k})`;
  ctx.beginPath();
  ctx.ellipse(
    plane.x + plane.altitude * 0.14, plane.y + plane.altitude * 0.1,
    52 * k + 14, 20 * k + 6, plane.heading, 0, Math.PI * 2,
  );
  ctx.fill();
}

/** The aircraft, drawn at the screen centre, nose up the current heading. */
export function drawPlane(ctx, cx, cy, plane) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.heading + Math.PI / 2); // sprite points up at heading 0 (north)
  ctx.scale(1 - Math.abs(plane.bank) * 0.18, 1);
  const s = 1; // sprite units are pixels
  // Main wings.
  ctx.fillStyle = '#d63a2f';
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(-64, 16);
  ctx.lineTo(-60, 30);
  ctx.lineTo(-6, 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, -2);
  ctx.lineTo(64, 16);
  ctx.lineTo(60, 30);
  ctx.lineTo(6, 16);
  ctx.closePath();
  ctx.fill();
  // Tail wings.
  ctx.fillStyle = '#b02a22';
  ctx.beginPath();
  ctx.moveTo(-4, 34);
  ctx.lineTo(-26, 48);
  ctx.lineTo(-22, 56);
  ctx.lineTo(-4, 46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 34);
  ctx.lineTo(26, 48);
  ctx.lineTo(22, 56);
  ctx.lineTo(4, 46);
  ctx.closePath();
  ctx.fill();
  // Tail fin.
  ctx.fillStyle = '#d63a2f';
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.lineTo(-7, 56);
  ctx.lineTo(7, 56);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  const fus = ctx.createLinearGradient(-8, 0, 8, 0);
  fus.addColorStop(0, '#f4f6f8');
  fus.addColorStop(0.5, '#ffffff');
  fus.addColorStop(1, '#c9d2da');
  ctx.fillStyle = fus;
  ctx.beginPath();
  ctx.moveTo(0, -62);
  ctx.quadraticCurveTo(9, -30, 8, 10);
  ctx.quadraticCurveTo(8, 44, 0, 58);
  ctx.quadraticCurveTo(-8, 44, -8, 10);
  ctx.quadraticCurveTo(-9, -30, 0, -62);
  ctx.fill();
  // Red cheatline.
  ctx.fillStyle = '#d63a2f';
  ctx.fillRect(-8, 6, 16, 5);
  // Cockpit windows.
  ctx.fillStyle = '#16324a';
  ctx.beginPath();
  ctx.moveTo(-6, -44);
  ctx.lineTo(6, -44);
  ctx.lineTo(5, -28);
  ctx.lineTo(-5, -28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(-5, -42);
  ctx.lineTo(0, -42);
  ctx.lineTo(-1, -30);
  ctx.lineTo(-4, -30);
  ctx.closePath();
  ctx.fill();
  // Propeller blur.
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, -62, 26, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- HUD

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.72)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.18)') {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 5);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w * clamp(frac, 0, 1), h, 5);
  ctx.fill();
}

export function drawHUD(ctx, g) {
  const { w, h, plane, mission, score, timeLeft, ringIndex, best } = g;
  const night = mission.night;

  // Top-left: the three instruments.
  panel(ctx, 16, 14, 300, 92);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('ALTITUDE', 30, 36);
  ctx.fillText('SPEED', 130, 36);
  ctx.fillText('HEADING', 224, 36);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`${Math.round(plane.altitude)}`, 30, 72);
  ctx.fillText(`${Math.round(plane.speedKnots)}`, 130, 72);
  ctx.fillText(`${String(Math.round(plane.headingDeg)).padStart(3, '0')}°`, 224, 72);
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('ft', 30, 92);
  ctx.fillText('kt', 130, 92);
  ctx.fillText('deg', 224, 92);

  // Top-centre: compass strip.
  const cx = w / 2, cy = 30;
  panel(ctx, cx - 190, 14, 380, 40);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(cx - 190, 14, 380, 40, 10);
  ctx.clip();
  const heading = plane.headingDeg;
  for (let d = -60; d <= 60; d += 5) {
    let deg = Math.round(heading + d);
    deg = ((deg % 360) + 360) % 360;
    const x = cx + d * 3;
    const major = deg % 30 === 0;
    ctx.strokeStyle = major ? '#fff' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, cy + 16);
    ctx.lineTo(x, cy + (major ? 2 : 8));
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      ctx.fillText(label, x, cy - 2);
    }
  }
  ctx.restore();
  ctx.fillStyle = '#ff5a4e';
  ctx.beginPath();
  ctx.moveTo(cx, cy + 18);
  ctx.lineTo(cx - 6, cy + 8);
  ctx.lineTo(cx + 6, cy + 8);
  ctx.closePath();
  ctx.fill();

  // Top-right: mission, score, timer, rings.
  panel(ctx, w - 316, 14, 300, 92);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd76e';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`MISSION ${mission.id} — ${mission.name.toUpperCase()}`, w - 300, 38);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  const mm = Math.floor(Math.max(0, timeLeft) / 60);
  const ss = String(Math.floor(Math.max(0, timeLeft) % 60)).padStart(2, '0');
  ctx.fillText(`SCORE ${score}`, w - 300, 70);
  ctx.fillStyle = timeLeft < 30 ? '#ff6b5e' : '#fff';
  ctx.fillText(`${mm}:${ss}`, w - 130, 70);
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '600 13px system-ui, sans-serif';
  const ringsText = mission.landing ? 'LAND THE PLANE' : `RINGS ${ringIndex}/${mission.rings.length}`;
  ctx.fillText(ringsText, w - 300, 94);
  ctx.fillText(`BEST ${best}`, w - 130, 94);

  // Bottom-left: throttle, fuel, damage.
  panel(ctx, 16, h - 118, 240, 102);
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText('THROTTLE', 30, h - 96);
  ctx.fillText('FUEL', 30, h - 62);
  ctx.fillText('DAMAGE', 30, h - 28);
  bar(ctx, 108, h - 106, 118, 12, plane.throttle, '#4fc3f7');
  bar(ctx, 108, h - 72, 118, 12, plane.fuel / 100, plane.fuel < 25 ? '#ff6b5e' : '#39d98a');
  bar(ctx, 108, h - 38, 118, 12, plane.damage / 100, '#ff8a3d');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, 238, h - 94);
  ctx.fillText(`${Math.round(plane.fuel)}%`, 238, h - 60);
  ctx.fillText(`${Math.round(plane.damage)}%`, 238, h - 26);
  ctx.textAlign = 'left';

  // Objective line under the compass.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(mission.short, cx, 76);

  // Next-ring arrow + distance, and the runway marker on mission 2.
  const target = mission.landing && ringIndex >= mission.rings.length
    ? { x: WORLD.runway.x, y: WORLD.runway.y, label: 'RUNWAY 09' }
    : mission.rings[ringIndex]
      ? { x: mission.rings[ringIndex].x, y: mission.rings[ringIndex].y, label: `RING ${ringIndex + 1}` }
      : null;
  if (target) {
    const dx = target.x - plane.x, dy = target.y - plane.y;
    const dist = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    const ax = cx + Math.cos(ang) * 110;
    const ay = h / 2 + Math.sin(ang) * 110;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = '#39ff88';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#baffdb';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`${target.label} — ${Math.round(dist)} m`, cx, h / 2 + 150);
  }

  // Warnings.
  const warnings = [];
  if (plane.fuel < 25 && plane.fuel > 0) warnings.push('LOW FUEL');
  if (plane.stalled) warnings.push('STALL — ADD THROTTLE');
  if (plane.damage > 60) warnings.push('HEAVY DAMAGE');
  if (mission.wind > 0) warnings.push('WIND GUSTS');
  if (warnings.length > 0 && Math.floor(g.time * 2) % 2 === 0) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(warnings.join('  •  '), cx, 112);
  }

  drawMinimap(ctx, g);
}

function drawMinimap(ctx, g) {
  const { w, h, plane, mission, ringIndex } = g;
  const mw = 210, mh = 163;
  const mx = w - mw - 16, my = h - mh - 16;
  const sx = mw / WORLD.width, sy = mh / WORLD.height;
  panel(ctx, mx, my, mw, mh);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, mw, mh, 10);
  ctx.clip();
  ctx.fillStyle = mission.night ? '#0a1a2e' : '#2f8fd0';
  ctx.fillRect(mx, my, mw, mh);
  for (const island of ISLANDS) {
    ctx.fillStyle = mission.night ? '#1d3a24' : '#5fae4e';
    ctx.beginPath();
    island.points.forEach((p, i) => {
      const x = mx + p.x * sx, y = my + p.y * sy;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }
  // Runway.
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mx + (WORLD.runway.x - WORLD.runway.length / 2) * sx, my + WORLD.runway.y * sy);
  ctx.lineTo(mx + (WORLD.runway.x + WORLD.runway.length / 2) * sx, my + WORLD.runway.y * sy);
  ctx.stroke();
  // Rings.
  mission.rings.forEach((ring, i) => {
    ctx.fillStyle = i < ringIndex ? '#78c878' : i === ringIndex ? '#39ff88' : 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(mx + ring.x * sx, my + ring.y * sy, i === ringIndex ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  // Plane.
  ctx.fillStyle = '#ffd76e';
  ctx.beginPath();
  ctx.arc(mx + plane.x * sx, my + plane.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd76e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx + plane.x * sx, my + plane.y * sy, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#9fb4c8';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MAP', mx + 8, my + 14);
}

/** Night darkening with a lit circle around the plane, plus rain streaks. */
export function drawNightAndRain(ctx, g) {
  const { w, h, plane } = g;
  if (g.mission.night) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 120, w / 2, h / 2, Math.max(w, h) * 0.62);
    grad.addColorStop(0, 'rgba(4, 8, 18, 0.12)');
    grad.addColorStop(1, 'rgba(4, 8, 18, 0.66)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    // Lightning flash, rare and brief.
    if (g.lightning > 0) {
      ctx.fillStyle = `rgba(220, 230, 255, ${g.lightning * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  if (g.mission.rain) {
    ctx.strokeStyle = 'rgba(180, 200, 230, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 90; i++) {
      const rx = ((i * 137.5 + g.time * 900) % (w + 40)) - 20;
      const ry = ((i * 89.3 + g.time * 1400) % (h + 40)) - 20;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 8, ry + 22);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------- screens

export function missionCardRects(w, h) {
  const cw = 300, ch = 170, gap = 26;
  const total = cw * 3 + gap * 2;
  const x0 = (w - total) / 2;
  const y = h * 0.42;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (cw + gap), y, w: cw, h: ch, mission: i + 1 }));
}

export function drawMenu(ctx, g) {
  const { w, h } = g;
  // Sky gradient with a soft sun and distant clouds.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2f6fb4');
  sky.addColorStop(0.55, '#7fb6e4');
  sky.addColorStop(1, '#cfe8f7');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255, 244, 200, 0.9)';
  ctx.beginPath();
  ctx.arc(w - 180, 120, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [cx, cy, r] of [[150, 130, 55], [1080, 100, 48], [990, 260, 40], [170, 330, 38]]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sea and island strip at the bottom.
  ctx.fillStyle = '#2f8fd0';
  ctx.fillRect(0, h - 150, w, 150);
  ctx.fillStyle = '#5fae4e';
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h - 120, 260, 60, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.7, h - 100, 340, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8d28a';
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h - 118, 270, 52, 0, 0, Math.PI);
  ctx.ellipse(w * 0.7, h - 98, 350, 62, 0, 0, Math.PI);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0b2233';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('MERPATI EXPRESS', w / 2, h * 0.2);
  ctx.fillStyle = '#123f5c';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('A little island-hopping flight game — throttle, turn, climb, and mind the fuel.', w / 2, h * 0.2 + 38);

  // Mission cards.
  const rects = missionCardRects(w, h);
  const { MISSIONS } = g;
  rects.forEach((r, i) => {
    const m = MISSIONS[i];
    const hover = g.menuHover === i;
    ctx.fillStyle = hover ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.88)';
    ctx.strokeStyle = hover ? '#ffd76e' : 'rgba(11,34,51,0.25)';
    ctx.lineWidth = hover ? 4 : 2;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0b2233';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`MISSION ${m.id}`, r.x + r.w / 2, r.y + 40);
    ctx.fillStyle = '#d63a2f';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(m.name, r.x + r.w / 2, r.y + 76);
    ctx.fillStyle = '#33475c';
    ctx.font = '16px system-ui, sans-serif';
    // Word-wrap the description inside the card (at most two lines).
    const words = m.short.split(' ');
    const lines = [''];
    for (const word of words) {
      const trial = lines[lines.length - 1] === '' ? word : `${lines[lines.length - 1]} ${word}`;
      if (ctx.measureText(trial).width > r.w - 36 && lines[lines.length - 1] !== '') lines.push(word);
      else lines[lines.length - 1] = trial;
    }
    lines.slice(0, 2).forEach((line, li) => ctx.fillText(line, r.x + r.w / 2, r.y + 100 + li * 20));
    ctx.fillStyle = '#123f5c';
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillText(`Best score: ${g.bests[i]}`, r.x + r.w / 2, r.y + 142);
  });

  ctx.fillStyle = '#0b2233';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText('Click a mission or press 1 / 2 / 3 to fly', w / 2, h * 0.42 + 210);
  ctx.fillStyle = '#123f5c';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('W/S or ↑/↓ throttle  •  A/D or ←/→ turn  •  Shift climb / Ctrl descend  •  Hold mouse to steer, wheel for throttle', w / 2, h * 0.42 + 242);
  ctx.fillText('P pause  •  M mute  •  Fly through the green rings — each one refills fuel', w / 2, h * 0.42 + 266);
  ctx.fillStyle = 'rgba(11,34,51,0.6)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText('Merpati Express — an original game, drawn and sounded entirely in code.', w / 2, h - 16);
}

export function drawPaused(ctx, g) {
  const { w, h } = g;
  ctx.fillStyle = 'rgba(4, 10, 20, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Press P or click to keep flying', w / 2, h / 2 + 30);
}

export function drawEnd(ctx, g) {
  const { w, h } = g;
  ctx.fillStyle = 'rgba(4, 10, 20, 0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  const won = g.endKind === 'complete';
  ctx.fillStyle = won ? '#39ff88' : '#ff6b5e';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText(won ? 'MISSION COMPLETE' : 'SORTIE OVER', w / 2, h / 2 - 90);
  ctx.fillStyle = '#fff';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(g.endMessage, w / 2, h / 2 - 44);
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`Score  ${g.score}`, w / 2, h / 2 + 8);
  ctx.fillStyle = '#ffd76e';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(`Best score for this mission: ${g.best}`, w / 2, h / 2 + 46);
  ctx.fillStyle = '#cfe0ee';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('R — fly again    •    Esc — back to the mission list', w / 2, h / 2 + 96);
}
