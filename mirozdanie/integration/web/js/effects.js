import {t} from "./i18n.js";
/* Lightweight particle system: sparks, stars, dust, damage numbers, confetti. */

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const MAX = 460;

export class Effects {
  constructor() {
    this.items = [];
    this.reduceMotion = false;
    this.showNumbers = true;
  }

  clear() {
    this.items.length = 0;
  }

  _push(item) {
    if (this.items.length > MAX) this.items.shift();
    item.life = item.life ?? 0.6;
    item.age = 0;
    item.vx = item.vx ?? 0;
    item.vy = item.vy ?? 0;
    item.g = item.g ?? 0;
    item.rot = item.rot ?? 0;
    item.spin = item.spin ?? 0;
    item.drag = item.drag ?? 0;
    this.items.push(item);
    return item;
  }

  /* ── emitters ────────────────────────────────────────────────────────── */

  impact(x, y, { power = 1, color = "#ffd166", angle = -Math.PI / 2 } = {}) {
    const count = this.reduceMotion ? 5 : Math.round(8 + power * 5);
    for (let i = 0; i < count; i += 1) {
      const a = angle + rand(-1.1, 1.1);
      const speed = rand(120, 420) * Math.min(1.8, power);
      this._push({
        type: "spark",
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        g: 900,
        life: rand(0.22, 0.5),
        size: rand(1.6, 4.2),
        color,
        drag: 2.4,
      });
    }
    this._push({
      type: "ring",
      x,
      y,
      life: 0.34,
      size: 10,
      growth: 260 * Math.min(1.6, power),
      color,
      width: 3.5,
    });
    if (!this.reduceMotion) {
      for (let i = 0; i < 3; i += 1) {
        this._push({
          type: "star",
          x: x + rand(-14, 14),
          y: y + rand(-14, 14),
          vx: rand(-90, 90),
          vy: rand(-220, -60),
          g: 620,
          life: rand(0.5, 0.9),
          size: rand(7, 13),
          color: "#ffd84d",
          spin: rand(-9, 9),
          rot: rand(0, TAU),
        });
      }
    }
    if (power > 1.6) this.shockwave(x, y, color);
  }

  dust(x, y, count = 8) {
    for (let i = 0; i < count; i += 1) {
      this._push({
        type: "dust",
        x: x + rand(-18, 18),
        y: y + rand(-8, 8),
        vx: rand(-130, 130),
        vy: rand(-90, -10),
        life: rand(0.4, 0.9),
        size: rand(6, 18),
        color: "rgba(210,200,190,0.5)",
        drag: 1.6,
      });
    }
  }

  shockwave(x, y, color = "#ffe0a0") {
    for (let i = 0; i < 2; i += 1) {
      this._push({
        type: "ring",
        x,
        y,
        life: 0.5 + i * 0.14,
        size: 12 + i * 18,
        growth: 520,
        color,
        width: 5 - i * 2,
      });
    }
  }

  zap(x, y, targetX, targetY) {
    this._push({
      type: "bolt",
      x,
      y,
      x2: targetX,
      y2: targetY,
      life: 0.16,
      color: "#9fe3ff",
      seed: Math.random() * 1000,
    });
    for (let i = 0; i < 8; i += 1) {
      this._push({
        type: "spark",
        x: targetX + rand(-8, 8),
        y: targetY + rand(-8, 8),
        vx: rand(-220, 220),
        vy: rand(-260, 100),
        g: 420,
        life: rand(0.2, 0.45),
        size: rand(1.5, 3.4),
        color: "#b9ecff",
      });
    }
  }

  foam(x, y) {
    for (let i = 0; i < 22; i += 1) {
      this._push({
        type: "foam",
        x: x + rand(-16, 16),
        y: y + rand(-16, 16),
        vx: rand(-140, 140),
        vy: rand(-190, -20),
        g: 120,
        life: rand(0.5, 1.1),
        size: rand(5, 14),
        color: "rgba(232,248,255,0.9)",
        drag: 2.2,
      });
    }
    this._push({
      type: "ring",
      x,
      y,
      life: 0.42,
      size: 8,
      growth: 220,
      color: "#d8f4ff",
      width: 4,
    });
  }

  confetti(x, y, count = 28) {
    const colors = ["#ffd166", "#ff6b6b", "#4da3ff", "#3ddc97", "#a06bff", "#fff"];
    for (let i = 0; i < count; i += 1) {
      this._push({
        type: "confetti",
        x: x + rand(-40, 40),
        y: y + rand(-20, 20),
        vx: rand(-220, 220),
        vy: rand(-460, -120),
        g: 720,
        life: rand(0.9, 1.7),
        size: rand(4, 9),
        color: pick(colors),
        spin: rand(-10, 10),
        rot: rand(0, TAU),
        drag: 0.6,
      });
    }
  }

  coin(x, y) {
    for (let i = 0; i < 5; i += 1) {
      this._push({
        type: "coin",
        x: x + rand(-16, 16),
        y: y + rand(-8, 8),
        vx: rand(-60, 60),
        vy: rand(-230, -140),
        g: 380,
        life: rand(0.55, 0.9),
        size: rand(7, 11),
        color: "#ffd54a",
        spin: rand(-6, 6),
      });
    }
  }

  word(x, y, text, { color = "#fff", size = 22, life = 0.9, vy = -150, weight = 900 } = {}) {
    this._push({ type: "word", x, y, text, color, size, weight, vy, life, drag: 1.2 });
  }

  damageNumber(x, y, value, { crit = false } = {}) {
    if (!this.showNumbers) return;
    this._push({
      type: "number",
      x: x + rand(-12, 12),
      y,
      text: crit ? `${t("crit")} ${Math.round(value)}` : String(Math.round(value)),
      color: crit ? "#ffde59" : "#ffffff",
      size: crit ? 30 : 21,
      vy: crit ? -210 : -160,
      life: crit ? 1.1 : 0.85,
      drag: 1.5,
      shadow: crit ? "#ff7a1a" : "rgba(0,0,0,0.55)",
      crit,
    });
  }

  /* ── simulation ──────────────────────────────────────────────────────── */

  update(dt) {
    const list = this.items;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      if (p.drag) {
        const damp = 1 - Math.min(0.95, p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  draw(ctx) {
    for (const p of this.items) {
      const t = p.age / p.life;
      const alpha = 1 - t * t;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      switch (p.type) {
        case "spark": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
          ctx.stroke();
          break;
        }
        case "ring": {
          const r = p.size + t * p.growth;
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = Math.max(0, (1 - t) * 0.85);
          ctx.lineWidth = Math.max(0.6, p.width * (1 - t));
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, TAU);
          ctx.stroke();
          break;
        }
        case "foam": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.7 + t * 0.9), 0, TAU);
          ctx.fill();
          break;
        }
        case "dust": {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.6 + t * 1.4), 0, TAU);
          ctx.fill();
          break;
        }
        case "star": {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          star(ctx, p.size * (1 - t * 0.35));
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.strokeStyle = "rgba(120,70,0,0.5)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
          break;
        }
        case "confetti": {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case "coin": {
          ctx.translate(p.x, p.y);
          const squish = Math.abs(Math.cos(p.rot));
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size * (0.35 + squish * 0.65), p.size, 0, 0, TAU);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.strokeStyle = "#b8860b";
          ctx.lineWidth = 1.4;
          ctx.stroke();
          break;
        }
        case "number": {
          ctx.font = `900 ${p.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
          ctx.textAlign = "center";
          ctx.lineWidth = 4;
          ctx.strokeStyle = "rgba(10,12,20,0.75)";
          ctx.strokeText(p.text, p.x, p.y);
          if (p.crit) {
            ctx.shadowColor = p.shadow;
            ctx.shadowBlur = 16;
          }
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x, p.y);
          ctx.shadowBlur = 0;
          if (p.crit) {
            ctx.globalAlpha = alpha * 0.6;
            ctx.fillStyle = "#ff9d2e";
            ctx.font = `900 ${p.size * 1.3}px system-ui, sans-serif`;
            ctx.fillText("!", p.x + ctx.measureText(p.text).width / 2 + 8, p.y);
          }
          break;
        }
        case "word": {
          const pop = t < 0.2 ? 0.7 + (t / 0.2) * 0.35 : 1.05 - (t - 0.2) * 0.06;
          ctx.translate(p.x, p.y);
          ctx.scale(pop, pop);
          ctx.font = `${p.weight} ${p.size}px system-ui, -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.lineWidth = 5;
          ctx.strokeStyle = "rgba(8,10,18,0.7)";
          ctx.strokeText(p.text, 0, 0);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, 0, 0);
          break;
        }
        case "bolt": {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 14;
          ctx.beginPath();
          const segments = 7;
          let sx = p.x;
          let sy = p.y;
          ctx.moveTo(sx, sy);
          for (let i = 1; i <= segments; i += 1) {
            const f = i / segments;
            const nx = p.x + (p.x2 - p.x) * f + (i < segments ? (Math.sin(p.seed + i * 2.7) * 26) : 0);
            const ny = p.y + (p.y2 - p.y) * f + (i < segments ? Math.cos(p.seed + i * 3.1) * 20 : 0);
            ctx.lineTo(nx, ny);
            sx = nx;
            sy = ny;
          }
          ctx.stroke();
          break;
        }
        case "swipe": {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, -0.9, 0.9);
          ctx.stroke();
          break;
        }
        default:
          break;
      }
      ctx.restore();
    }
  }
}

function star(ctx, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = (i / 10) * TAU - Math.PI / 2;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
