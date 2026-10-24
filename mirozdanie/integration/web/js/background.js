/* Stage backdrop: a painted night classroom, or any image the player uploads. */

const TAU = Math.PI * 2;

export class Background {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.layer = null;
    this.image = null;
    this.imageMeta = null;
    this.t = 0;
    this.pointer = { x: 0, y: 0 };
    this.motes = [];
    this.stars = [];
  }

  setImage(image, meta) {
    this.image = image || null;
    this.imageMeta = meta || null;
  }

  resize(width, height, dpr = 1) {
    this.width = width;
    this.height = height;
    this.dpr = Math.min(dpr, 2.5);
    this.motes = Array.from({ length: 42 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.6 + Math.random() * 1.9,
      vy: -3 - Math.random() * 9,
      vx: (Math.random() - 0.5) * 7,
      a: 0.12 + Math.random() * 0.4,
      phase: Math.random() * TAU,
    }));
    this.stars = Array.from({ length: 26 }, () => ({
      x: 0.62 + Math.random() * 0.34,
      y: 0.12 + Math.random() * 0.3,
      r: 0.4 + Math.random() * 1.1,
      phase: Math.random() * TAU,
      speed: 0.6 + Math.random() * 1.6,
    }));
    this._paintLayer();
  }

  update(dt, pointer) {
    this.t += dt;
    if (pointer) {
      this.pointer.x += (pointer.x - this.width / 2 - this.pointer.x) * Math.min(1, dt * 2);
      this.pointer.y += (pointer.y - this.height / 2 - this.pointer.y) * Math.min(1, dt * 2);
    }
    for (const m of this.motes) {
      m.y += m.vy * dt;
      m.x += m.vx * dt + Math.sin(this.t + m.phase) * 0.15;
      if (m.y < -10) {
        m.y = this.height + 10;
        m.x = Math.random() * this.width;
      }
    }
  }

  draw(ctx) {
    const { width: w, height: h } = this;
    const px = (this.pointer.x / Math.max(1, w)) * 10;
    const py = (this.pointer.y / Math.max(1, h)) * 6;

    if (this.image) {
      this._drawImage(ctx, w, h, px, py);
      this._drawMotes(ctx);
      return;
    }

    ctx.save();
    ctx.translate(px, py);
    if (this.layer) {
      ctx.drawImage(this.layer, -10, -10, w + 20, h + 20);
    } else {
      this._paintBackground(ctx, w, h);
    }
    ctx.restore();

    this._drawLamp(ctx, w, h, px, py);
    this._drawNightExtras(ctx, w, h);
    this._drawMotes(ctx);
  }

  _drawImage(ctx, w, h, px, py) {
    const img = this.image;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const scale = Math.max((w + 24) / iw, (h + 24) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (w - dw) / 2 + px * 0.6;
    const dy = (h - dh) / 2 + py * 0.6;
    ctx.save();
    ctx.drawImage(img, dx, dy, dw, dh);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(6,9,18,0.42)");
    grad.addColorStop(0.35, "rgba(6,9,18,0.06)");
    grad.addColorStop(0.72, "rgba(6,9,18,0.42)");
    grad.addColorStop(1, "rgba(6,9,18,0.88)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // ground shadow so the doll is anchored to the photo
    const g = ctx.createRadialGradient(w / 2, h * 0.78, 10, w / 2, h * 0.78, w * 0.5);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  }

  _paintLayer() {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(this.width * this.dpr));
    canvas.height = Math.max(1, Math.floor(this.height * this.dpr));
    const ctx = canvas.getContext("2d");
    ctx.scale(this.dpr, this.dpr);
    this._paintBackground(ctx, this.width, this.height);
    this.layer = canvas;
    this.still = true;
  }

  _paintBackground(ctx, w, h) {
    if (!w || !h) return;
    // wall
    const wall = ctx.createLinearGradient(0, 0, 0, h);
    wall.addColorStop(0, "#171d33");
    wall.addColorStop(0.5, "#131a2c");
    wall.addColorStop(1, "#0d1220");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);

    // wall panel lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += w / 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h * 0.74);
      ctx.stroke();
    }

    const floorY = h * 0.68;

    // chalkboard
    const bw = Math.min(w * 0.62, 430);
    const bh = bw * 0.58;
    const bx = w * 0.5 - bw / 2 - w * 0.05;
    const by = h * 0.11;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#5b3d29";
    this._rr(ctx, bx - 10, by - 10, bw + 20, bh + 20, 8);
    ctx.fill();
    ctx.restore();
    const board = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    board.addColorStop(0, "#1d3b32");
    board.addColorStop(0.55, "#1a352d");
    board.addColorStop(1, "#142a24");
    ctx.fillStyle = board;
    this._rr(ctx, bx, by, bw, bh, 4);
    ctx.fill();
    // chalk smudges
    ctx.save();
    this._rr(ctx, bx, by, bw, bh, 4);
    ctx.clip();
    for (let i = 0; i < 16; i += 1) {
      ctx.beginPath();
      ctx.ellipse(
        bx + Math.random() * bw,
        by + Math.random() * bh,
        10 + Math.random() * 60,
        4 + Math.random() * 22,
        Math.random() * TAU,
        0,
        TAU
      );
      ctx.fillStyle = `rgba(235,245,235,${0.012 + Math.random() * 0.02})`;
      ctx.fill();
    }
    // chalk writing
    ctx.fillStyle = "rgba(232,244,236,0.72)";
    ctx.font = `700 ${Math.round(bh * 0.13)}px "Segoe Print", "Bradley Hand", cursive, sans-serif`;
    ctx.fillText("E = m c²", bx + bw * 0.07, by + bh * 0.28);
    ctx.font = `600 ${Math.round(bh * 0.08)}px "Segoe Print", "Bradley Hand", cursive, sans-serif`;
    ctx.fillStyle = "rgba(232,244,236,0.5)";
    ctx.fillText("F = m a", bx + bw * 0.1, by + bh * 0.45);
    ctx.fillText("∫ f(x) dx = ?", bx + bw * 0.47, by + bh * 0.42);
    ctx.fillText("Домашнее задание: стр. 42", bx + bw * 0.07, by + bh * 0.66);
    ctx.strokeStyle = "rgba(232,244,236,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.07, by + bh * 0.72);
    ctx.lineTo(bx + bw * 0.55, by + bh * 0.72);
    ctx.stroke();
    // a doodle of a stick figure being kicked
    ctx.strokeStyle = "rgba(255,210,150,0.55)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(bx + bw * 0.83, by + bh * 0.3, bh * 0.055, 0, TAU);
    ctx.moveTo(bx + bw * 0.83, by + bh * 0.355);
    ctx.lineTo(bx + bw * 0.83, by + bh * 0.46);
    ctx.moveTo(bx + bw * 0.83, by + bh * 0.46);
    ctx.lineTo(bx + bw * 0.79, by + bh * 0.54);
    ctx.moveTo(bx + bw * 0.83, by + bh * 0.46);
    ctx.lineTo(bx + bw * 0.89, by + bh * 0.52);
    ctx.stroke();
    ctx.restore();

    // chalk tray
    ctx.fillStyle = "#6b4a33";
    this._rr(ctx, bx - 6, by + bh, bw + 12, 9, 4);
    ctx.fill();
    ctx.fillStyle = "#e8efe6";
    for (let i = 0; i < 3; i += 1) {
      this._rr(ctx, bx + 18 + i * 26, by + bh + 1.5, 16, 4.5, 2);
      ctx.fill();
    }

    // window
    const ww = Math.min(w * 0.3, 180);
    const wh = ww * 1.5;
    const wx = w - ww - w * 0.07;
    const wy = h * 0.1;
    ctx.save();
    this._rr(ctx, wx - 7, wy - 7, ww + 14, wh + 14, 8);
    ctx.fillStyle = "#2a3350";
    ctx.fill();
    const sky = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    sky.addColorStop(0, "#101a35");
    sky.addColorStop(0.6, "#16294b");
    sky.addColorStop(1, "#0e1a30");
    this._rr(ctx, wx, wy, ww, wh, 5);
    ctx.fillStyle = sky;
    ctx.fill();
    // moon
    ctx.beginPath();
    ctx.arc(wx + ww * 0.68, wy + wh * 0.2, ww * 0.14, 0, TAU);
    ctx.fillStyle = "#f6f1d6";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(wx + ww * 0.74, wy + wh * 0.17, ww * 0.11, 0, TAU);
    ctx.fillStyle = "#16294b";
    ctx.fill();
    // city silhouette
    ctx.fillStyle = "rgba(6,11,22,0.85)";
    let cx2 = wx;
    while (cx2 < wx + ww) {
      const bw2 = 10 + Math.random() * 20;
      const bh2 = 20 + Math.random() * wh * 0.28;
      ctx.fillRect(cx2, wy + wh - bh2, bw2, bh2);
      cx2 += bw2 + 3;
    }
    // frame cross
    ctx.strokeStyle = "#39456a";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh * 0.52);
    ctx.lineTo(wx + ww, wy + wh * 0.52);
    ctx.stroke();
    ctx.restore();

    // poster
    const pw = Math.min(w * 0.2, 108);
    const ph = pw * 1.3;
    const pxx = w * 0.06;
    const pyy = h * 0.15;
    ctx.save();
    ctx.translate(pxx, pyy);
    ctx.rotate(-0.03);
    this._rr(ctx, 0, 0, pw, ph, 4);
    ctx.fillStyle = "rgba(238,240,248,0.9)";
    ctx.fill();
    ctx.fillStyle = "rgba(40,60,90,0.8)";
    ctx.font = `800 ${Math.round(pw * 0.13)}px system-ui, sans-serif`;
    ctx.fillText("ТАБЛИЦА", pw * 0.11, ph * 0.2);
    ctx.fillText("ЭЛЕМЕНТОВ", pw * 0.11, ph * 0.34);
    for (let r = 0; r < 5; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        ctx.fillStyle = `rgba(${90 + r * 20},${130 + c * 18},${190 - r * 10},0.55)`;
        ctx.fillRect(pw * 0.1 + c * pw * 0.2, ph * 0.44 + r * ph * 0.1, pw * 0.17, ph * 0.075);
      }
    }
    ctx.restore();

    // floor
    const floor = ctx.createLinearGradient(0, floorY, 0, h);
    floor.addColorStop(0, "#2a2036");
    floor.addColorStop(0.35, "#1d1727");
    floor.addColorStop(1, "#0e0b15");
    ctx.fillStyle = floor;
    ctx.fillRect(0, floorY, w, h - floorY);
    ctx.strokeStyle = "rgba(255,255,255,0.045)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      const xTop = w * 0.5 + (t - 0.5) * w * 0.6;
      const xBot = w * 0.5 + (t - 0.5) * w * 1.7;
      ctx.beginPath();
      ctx.moveTo(xTop, floorY);
      ctx.lineTo(xBot, h);
      ctx.stroke();
    }
    for (let i = 1; i < 6; i += 1) {
      const y = floorY + (h - floorY) * Math.pow(i / 6, 1.7);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // skirting board
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.fillRect(0, floorY - 8, w, 8);

    // desks in silhouette at the edges
    ctx.fillStyle = "rgba(8,10,18,0.8)";
    ctx.fillRect(-24, floorY - 60, w * 0.26, 13);
    ctx.fillRect(w * 0.05, floorY - 47, 8, 52);
    ctx.fillRect(w * 0.19, floorY - 47, 8, 52);
    ctx.fillRect(w * 0.76, floorY - 54, w * 0.3, 13);
    ctx.fillRect(w * 0.82, floorY - 41, 8, 48);

    // corner darkening
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(3,5,12,0.75)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    // pool of light around the Professor
    const light = ctx.createRadialGradient(w * 0.5, h * 0.6, 20, w * 0.5, h * 0.6, Math.min(w, h) * 0.62);
    light.addColorStop(0, "rgba(255,214,150,0.16)");
    light.addColorStop(0.45, "rgba(255,190,120,0.06)");
    light.addColorStop(1, "rgba(255,180,120,0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
  }

  _drawLamp(ctx, w, h, px, py) {
    const x = w * 0.5 + px * 1.4;
    const y = h * 0.03;
    const flicker = 0.9 + Math.sin(this.t * 7.3) * 0.012 + Math.sin(this.t * 2.1) * 0.02;
    ctx.save();
    // cord
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.lineTo(x, y + 22);
    ctx.stroke();
    // shade
    ctx.beginPath();
    ctx.moveTo(x - 26, y + 34);
    ctx.lineTo(x - 9, y + 12);
    ctx.lineTo(x + 9, y + 12);
    ctx.lineTo(x + 26, y + 34);
    ctx.closePath();
    const shade = ctx.createLinearGradient(x - 26, y + 12, x + 26, y + 34);
    shade.addColorStop(0, "#3a4258");
    shade.addColorStop(1, "#1d2334");
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();
    // bulb
    ctx.beginPath();
    ctx.arc(x, y + 36, 5, 0, TAU);
    ctx.fillStyle = `rgba(255,236,180,${flicker})`;
    ctx.fill();
    // cone
    const cone = ctx.createLinearGradient(x, y + 36, x, h * 0.8);
    cone.addColorStop(0, `rgba(255,226,160,${0.18 * flicker})`);
    cone.addColorStop(1, "rgba(255,220,160,0)");
    ctx.beginPath();
    ctx.moveTo(x - 22, y + 36);
    ctx.lineTo(x + 22, y + 36);
    ctx.lineTo(x + w * 0.33, h * 0.8);
    ctx.lineTo(x - w * 0.33, h * 0.8);
    ctx.closePath();
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.restore();
    void py;
  }

  _drawNightExtras(ctx, w, h) {
    const ww = Math.min(w * 0.3, 180);
    const wh = ww * 1.5;
    const wx = w - ww - w * 0.07;
    const wy = h * 0.1;
    ctx.save();
    this._rr(ctx, wx, wy, ww, wh, 5);
    ctx.clip();
    for (const st of this.stars) {
      const x = wx + st.x * ww * 0.95;
      const y = wy + (st.y - 0.1) * wh * 0.9;
      if (x < wx || x > wx + ww || y < wy || y > wy + wh) continue;
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(this.t * st.speed + st.phase));
      ctx.globalAlpha = twinkle;
      ctx.fillStyle = "#e8f1ff";
      ctx.beginPath();
      ctx.arc(x, y, st.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawMotes(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(this.t * 1.6 + m.phase));
      ctx.fillStyle = "#ffe6b0";
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  _rr(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
