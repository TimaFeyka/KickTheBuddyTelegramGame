import {t} from "./i18n.js";
import {modalOpen} from "./ui.js";
/* Game engine: input, combat maths, physics loop and rendering. */

import { Doll } from "./doll.js";
import { Attacker } from "./attacker.js";
import { Effects } from "./effects.js";
import { Background } from "./background.js";
import { audio } from "./audio.js";
import { haptic } from "./telegram.js";
import { WEAPON_BY_ID } from "./content.js";
import { coinReward } from "./content.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class Game {
  constructor(canvas, { store, onHud, onRoundEnd, onMilestone } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.store = store;
    this.onHud = onHud || (() => {});
    this.onRoundEnd = onRoundEnd || (() => {});
    this.onMilestone = onMilestone || (() => {});

    this.doll = new Doll({
      onImpact: (kind, x, y, force) => {
        if (kind === "ground") {
          this.effects.dust(x, y, Math.min(18, 6 + force / 90));
          this.shake = Math.max(this.shake, Math.min(10, force / 60));
        }
      },
    });
    this.effects = new Effects();
    this.attacker = new Attacker();
    this.background = new Background();

    this.weaponId = store.state.equipped || "kick";
    this.cooldowns = {};
    this.maxHp = store.maxHp;
    this.hp = this.maxHp;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.rage = 0;
    this.rageTime = 0;
    this.round = this._freshRound();
    this.roundNumber = 1;
    this.shake = 0;
    this.hitStop = 0;
    this.timeScale = 1;
    this.koActive = false;
    this.koDelay = 0;
    this.taunt = null;
    this.tauntTimer = 6 + Math.random() * 4;
    this.flash = 0;
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.raf = 0;
    this.hudTimer = 0;
    this.hudDirty = true;
    this.pointer = { x: 0, y: 0, down: false };
    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.started = false;
    this.reduceMotion = false;
    this._bindInput();
  }

  _freshRound() {
    return { damage: 0, hits: 0, maxCombo: 0, coins: 0, kos: 0, crits: 0 };
  }

  /* ── lifecycle ───────────────────────────────────────────────────────── */

  mount() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 220));
    window.addEventListener("keydown", (event) => this._onKey(event));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause();
      else this.resume();
    });
    this._loop = (time) => this._frame(time);
    return this;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || window.innerWidth);
    const height = Math.max(1, rect.height || window.innerHeight);
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.background.resize(width, height, this.dpr);
    this.doll.resize(width, height);
    this.hudDirty = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this._loop);
    this.setWeapon(this.store.state.equipped || "kick");
  }

  pause() {
    this.paused = true;
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this.lastTime = performance.now();
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /* ── configuration ───────────────────────────────────────────────────── */

  applySettings(settings) {
    this.reduceMotion = Boolean(settings.reduceGlow);
    this.effects.reduceMotion = this.reduceMotion;
    this.effects.showNumbers = settings.damageNumbers !== false;
    audio.setEnabled(settings.sound !== false);
    this.backgroundFx = settings.sound;
    this.hudDirty = true;
  }

  refreshStats() {
    const previousMax = this.maxHp;
    this.maxHp = this.store.maxHp;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    if (this.hp <= 0) this.hp = this.maxHp;
    if (previousMax !== this.maxHp) this.hudDirty = true;
  }

  setWeapon(id) {
    if (!WEAPON_BY_ID[id]) return false;
    this.weaponId = id;
    this.hudDirty = true;
    return true;
  }

  /** Play the equipped weapon once, without damage (weapon preview). */
  showWeapon(id) {
    return this.previewWeapon(id);
  }

  setFace(image, meta) {
    this.doll.setFace(image, meta);
  }

  setDoll(image, meta) {
    this.doll.setDollImage(image, meta);
  }

  setBackground(image, meta) {
    this.background.setImage(image, meta);
  }

  setVoice(voice) {
    audio.configureVoice(voice);
  }

  /* ── input ───────────────────────────────────────────────────────────── */

  _bindInput() {
    const canvas = this.canvas;
    const pos = (event) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    canvas.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      canvas.setPointerCapture?.(event.pointerId);
      const { x, y } = pos(event);
      this.pointer.down = true;
      this.pointer.x = x;
      this.pointer.y = y;
      this.doll.setPointer(x, y);
      this.started = true;
      this.attack(this.weaponId, x, y);
    });

    canvas.addEventListener("pointermove", (event) => {
      const { x, y } = pos(event);
      this.pointer.x = x;
      this.pointer.y = y;
      this.doll.setPointer(x, y);
      if (this.pointer.down) this.attack(this.weaponId, x, y, { dragging: true });
    });

    const release = () => {
      this.pointer.down = false;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", release);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  _onKey(event) {
    if (event.repeat || modalOpen() || this.store.blocked || event.target?.closest?.("button,input,textarea,select,a")) return;
    const digit = Number(event.key);
    if (digit >= 1 && digit <= 9) {
      const owned = this.store.state.owned;
      const weapons = ["kick", "punch", "slap", "flipflop", "ruler", "bat", "pan", "taser", "bomb"];
      const id = weapons[digit - 1];
      if (id && owned.includes(id)) this.setWeapon(id);
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      this.attack(this.weaponId, this.doll.basePosition.x, this.doll.basePosition.y - 60 * this.doll.scale);
    }
  }

  /* ── combat ──────────────────────────────────────────────────────────── */

  cooldownRemaining(id) {
    return Math.max(0, this.cooldowns[id] || 0);
  }

  cooldownRatio(id) {
    const weapon = WEAPON_BY_ID[id];
    if (!weapon) return 0;
    return clamp(this.cooldownRemaining(id) / weapon.cooldown, 0, 1);
  }

  /** Screen-space scale so weapon rigs look identical on every device. */
  get unit() {
    return Math.min(this.width || 430, this.height || 780) / 430;
  }

  /** Resolve what the player aimed at, or null when they tapped the void. */
  _resolveTarget(x, y, { dragging = false } = {}) {
    const shape = this.doll.hitTest(x, y, 46);
    if (shape) return { x: shape.x, y: shape.y, part: shape.part };

    const cx = this.doll.basePosition.x + this.doll.root.ox;
    const cy = this.doll.basePosition.y - 60 * this.doll.scale;
    if (dragging || Math.hypot(x - cx, y - cy) > 240 * this.doll.scale) return null;

    let nearest = null;
    let best = Infinity;
    for (const s of this.doll.shapes || []) {
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    if (nearest) return { x: nearest.x, y: nearest.y, part: nearest.part };
    const torso = this.doll.world?.torso;
    if (!torso) return null;
    return { x: torso.wx, y: torso.wy - 20 * this.doll.scale, part: "torso" };
  }

  /**
   * Swing a weapon. The rig is animated in first; damage is applied by
   * `_landHit` when the weapon actually reaches the target.
   */
  attack(id, x, y, { dragging = false, preview = false } = {}) {
    const weapon = WEAPON_BY_ID[id];
    if (!weapon || this.store.blocked || this.paused || modalOpen()) return false;
    if (!preview && this.cooldownRemaining(id) > 0) return false;
    if (this.koActive) return false;

    const target = this._resolveTarget(x, y, { dragging });
    if (!target) return false;

    if (!preview) {
      this.cooldowns[id] =
        weapon.cooldown * (this.rageTime > 0 ? 0.55 : 1) + (weapon.swing || 0) * 0.15;
    }
    this.started = true;
    this.hudDirty = true;

    this.attacker.start(weapon, target, {
      width: this.width,
      height: this.height,
      unit: this.unit,
      onHit: (event) => {
        if (preview) {
          this.effects.dust(event.x, event.y, 4);
          this.shake = Math.max(this.shake, 2);
          return;
        }
        this._landHit(weapon, target, event);
      },
    });

    // wind-up feedback: the swing whoosh before the impact
    audio.sfx(weapon.motion === "projectile" ? "rocket" : "whoosh", { volume: 0.42 });
    if (!preview) haptic(weapon.swing && weapon.swing > 700 ? "medium" : "light");
    return true;
  }

  /** Show a weapon without dealing damage (used when equipping in the dock). */
  previewWeapon(id) {
    const weapon = WEAPON_BY_ID[id];
    if (!weapon || this.koActive) return false;
    const x = this.doll.basePosition.x + this.doll.root.ox;
    const y = this.doll.basePosition.y - 40 * this.doll.scale;
    return this.attack(id, x, y, { preview: true, dragging: true });
  }

  /** Damage maths + feedback, fired the moment the rig connects. */
  _landHit(weapon, target, event) {
    if (this.koActive) return;
    const mult = event.mult ?? 1;
    const part = target.part || "torso";
    const hitX = event.x;
    const hitY = event.y;

    const stunned = this.doll.stun > 0;
    const crit = Math.random() < this.store.critChance;
    let damage = weapon.damage * mult * this.store.damageMultiplier;
    if (this.rageTime > 0) damage *= 2;
    if (stunned) damage *= 1.15;
    if (crit) damage *= 2.5;
    damage *= 1 + Math.min(0.8, this.combo * 0.008);
    damage = Math.max(1, Math.round(damage));

    this.hp = Math.max(0, this.hp - damage);
    this.round.damage += damage;
    this.round.hits += 1;
    if (crit) this.round.crits += 1;
    this.combo += 1;
    this.comboTimer = 2.1;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.round.maxCombo = Math.max(this.round.maxCombo, this.combo);
    this.rage = clamp(this.rage + (crit ? 5.5 : 3.1), 0, 100);
    if (this.rage >= 100 && this.rageTime <= 0) this._activateRage();

    const coinGain = (damage / 14) * this.store.coinMultiplier;
    this._coinBuffer = (this._coinBuffer || 0) + coinGain;
    if (this._coinBuffer >= 1) {
      const whole = Math.floor(this._coinBuffer);
      this._coinBuffer -= whole;
      this.store.addCoins(whole);
      this.round.coins += whole;
    }

    const power = clamp(damage / 220, 0.5, 3.2);
    this.doll.hurt(damage, { x: hitX, y: hitY, part }, (weapon.knock || 1) * mult, {
      heavy: Boolean(weapon.stun),
    });
    if (weapon.stun) this.doll.stun = Math.max(this.doll.stun, weapon.stun);

    const angle = Math.atan2(hitY - this.doll.basePosition.y, hitX - this.doll.basePosition.x);
    const colors = {
      kick: "#ffe08a",
      punch: "#ffd9a0",
      slap: "#ffc2d1",
      swing: "#ffd166",
      zap: "#a9e6ff",
      foam: "#d8f4ff",
      boom: "#ffb37a",
    };
    this.effects.impact(hitX, hitY, {
      power,
      color: colors[weapon.style] || "#ffd166",
      angle: angle + Math.PI,
    });
    this.effects.damageNumber(hitX, hitY - 22, damage, { crit });
    if (crit) {
      this.effects.word(hitX, hitY - 58, t("crit")+"!", { color: "#ffd84d", size: 16, life: 0.8 });
    }
    if (weapon.style === "zap") this.effects.zap(hitX + 150, this.height * 0.2, hitX, hitY);
    if (weapon.style === "foam") this.effects.foam(hitX, hitY);
    if (weapon.style === "boom") {
      this.effects.shockwave(hitX, hitY, "#ffcf7a");
      this.effects.confetti(hitX, hitY, 16);
    }
    if (weapon.id === "saw") {
      this.effects.zap(hitX + 90, hitY - 40, hitX, hitY);
    }

    this.shake = Math.max(this.shake, clamp(damage / 70, 2, 14) * (this.reduceMotion ? 0.35 : 1));
    this.hitStop = Math.max(
      this.hitStop,
      weapon.style === "boom" ? 0.12 : clamp(damage / 1900, 0.02, 0.08)
    );

    audio.sfx(weapon.sound, { volume: 0.95, pitch: 0.94 + Math.random() * 0.14 });
    if (weapon.stun) audio.voice("special", { chance: 0.65 });
    else audio.voice("hit", { chance: part === "head" ? 0.55 : 0.32 });

    haptic(power > 1.8 ? "heavy" : power > 1 ? "medium" : "light");

    if (this.hp <= 0) this._beginKo();
    this.hudDirty = true;
  }

  _activateRage() {
    this.rage = 100;
    this.rageTime = 8;
    this.flash = 0.7;
    this.shake = Math.max(this.shake, 12);
    audio.sfx("rage", { volume: 1 });
    audio.voice("special", { chance: 1 });
    this.onMilestone({ type: "rage" });
    this.hudDirty = true;
  }

  _beginKo() {
    this.koActive = true;
    this.koDelay = 2.5;
    this.round.kos += 1;
    this.doll.ko(2.35);
    this.timeScale = 0.35;
    this.hitStop = 0.18;
    this.shake = Math.max(this.shake, 15);
    this.flash = 0.55;
    this.effects.confetti(this.doll.basePosition.x, this.doll.basePosition.y - 120 * this.doll.scale, 34);
    this.effects.shockwave(this.doll.basePosition.x, this.doll.basePosition.y, "#ffe6a8");
    this.effects.word(this.doll.basePosition.x, this.height * 0.3, t("ko"), {
      color: "#ffd84d",
      size: 46,
      life: 1.4,
      vy: -40,
    });
    audio.sfx("ko", { volume: 1 });
    audio.voice("ko", { chance: 1 });
    haptic("success");

    const bonus = coinReward(0, 0, 120 + Math.min(400, this.roundNumber * 15));
    this.store.addCoins(bonus);
    this.round.coins += bonus;
    this.effects.coin(this.doll.basePosition.x, this.doll.basePosition.y - 40);

    this.onRoundEnd({
      round: this.roundNumber,
      damage: this.round.damage,
      combo: this.round.maxCombo,
      kos: 1,
      coins: this.round.coins,
      crits: this.round.crits,
      bestCombo: this.bestCombo,
    });
    this.round.damage = 0;
    this.round.coins = 0;
    this.round.maxCombo = 0;
    this.round.crits = 0;
  }

  _endKo() {
    this.koActive = false;
    this.roundNumber += 1;
    this.round = this._freshRound();
    this.hp = this.maxHp;
    this.combo = 0;
    this.rage = Math.min(this.rage, 35);
    this.tauntTimer = 3;
    this.hudDirty = true;
  }

  /* ── loop ────────────────────────────────────────────────────────────── */

  _frame(time) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this._loop);
    if (this.paused) {
      this.lastTime = time;
      return;
    }
    const raw = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const dt = clamp(raw, 0, 1 / 20);

    let scale = this.timeScale;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      scale = 0.06;
    }
    if (this.koActive) {
      scale = Math.min(scale, 0.55);
    }
    if (this.rageTime > 0) scale = Math.min(1.15, scale + 0.05);
    scale = clamp(scale, 0.04, 1.2);

    this._update(dt * scale, dt);
    this._render(dt);
  }

  _update(dt, realDt) {
    const step = Math.min(dt, 1 / 30);

    for (const id of Object.keys(this.cooldowns)) {
      this.cooldowns[id] = Math.max(0, this.cooldowns[id] - realDt * 1000);
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= realDt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.hudDirty = true;
      }
    }

    if (this.rageTime > 0) {
      this.rageTime = Math.max(0, this.rageTime - realDt);
      this.rage = (this.rageTime / 8) * 100;
      if (this.rageTime <= 0) {
        this.rage = 0;
        this.onMilestone({ type: "rageEnd" });
      }
      this.hudDirty = true;
    }

    if (this.koActive) {
      this.koDelay -= realDt;
      if (this.koDelay <= 0) this._endKo();
    }

    // idle taunts
    if (!this.koActive) {
      this.tauntTimer -= realDt;
      if (this.tauntTimer <= 0) {
        this.tauntTimer = 8 + Math.random() * 7;
        const bank = {
          ru: ["Это всё?", "Останьтесь после уроков!", "Тише, идёт занятие!", "А домашнее задание?"],
          en: ["Is that all?", "Detention!", "Class, settle down.", "Pathetic effort!"],
          ar: ["هذا كل ما لديك؟", "احتجاز!", "اجلسوا يا طلاب!"],
          de: ["War das alles?", "Nachsitzen!", "Ruhe bitte!"],
          es: ["¿Eso es todo?", "¡Castigado!", "¡Silencio en clase!"],
        };
        const lang = (document.documentElement.lang || "ru").slice(0, 2);
        const list = bank[lang] || bank.ru;
        this.taunt = { text: list[(Math.random() * list.length) | 0], life: 2.4 };
        audio.voice("taunt", { chance: 0.8 });
      }
    }
    if (this.taunt) {
      this.taunt.life -= realDt;
      if (this.taunt.life <= 0) this.taunt = null;
    }

    this.doll.update(step);
    this.attacker.update(realDt);
    this.effects.update(dt);
    this.background.update(realDt, this.pointer);

    this.shake *= Math.pow(0.0016, realDt);
    if (this.shake < 0.15) this.shake = 0;
    this.flash = Math.max(0, this.flash - realDt * 1.6);
    this.timeScale += (1 - this.timeScale) * Math.min(1, realDt * 3.2);

    this.hudTimer += realDt;
    if (this.hudDirty || this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.hudDirty = false;
      this._emitHud();
    }
  }

  _emitHud() {
    this.onHud({
      hp: this.hp,
      maxHp: this.maxHp,
      combo: this.combo,
      comboMultiplier: 1 + Math.min(0.8, this.combo * 0.008),
      rage: this.rage,
      rageActive: this.rageTime > 0,
      round: this.roundNumber,
      weapon: this.weaponId,
      coins: this.store.state.coins,
      ko: this.koActive,
      cooldowns: Object.fromEntries(
        Object.keys(this.cooldowns).map((id) => [id, this.cooldownRatio(id)])
      ),
    });
  }

  /* ── render ──────────────────────────────────────────────────────────── */

  _render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    if (this.shake > 0.1) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }
    this.background.draw(ctx);

    // pointer ring below the doll
    this.doll.draw(ctx);
    this.attacker.draw(ctx, { unit: this.unit });
    this.effects.draw(ctx);
    this._drawTaunt(ctx);
    ctx.restore();

    if (this.rageTime > 0) {
      const pulse = 0.1 + Math.sin(performance.now() / 160) * 0.03;
      ctx.save();
      ctx.globalCompositeOperation = "overlay";
      const grad = ctx.createRadialGradient(w / 2, h * 0.6, 20, w / 2, h * 0.6, Math.max(w, h) * 0.8);
      grad.addColorStop(0, `rgba(255,120,40,${pulse})`);
      grad.addColorStop(1, `rgba(255,60,0,${pulse * 1.8})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.5, this.flash);
      ctx.fillStyle = "#fff4d6";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (this.koActive) {
      // desaturate + vignette while he's down
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#0a0b14";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  _drawTaunt(ctx) {
    if (!this.taunt || !this.doll.world) return;
    const head = this.doll.world.head;
    const x = clamp(head.wx, 90, this.width - 90);
    const y = head.wy - this.doll.B.headR * this.doll.scale * 1.9;
    const text = this.taunt.text;
    ctx.save();
    ctx.font = `800 13px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const metrics = ctx.measureText(text);
    const w = Math.min(this.width - 24, metrics.width + 30);
    const h = 38;
    const alpha = Math.min(1, this.taunt.life * 2);
    ctx.globalAlpha = alpha;
    ctx.translate(x, y - h);
    ctx.rotate(-0.02);
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = "rgba(250,250,255,0.97)";
    roundRectPath(ctx, -w / 2, 0, w, h, 15);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.moveTo(14, h - 1);
    ctx.lineTo(34, h + 12);
    ctx.lineTo(44, h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#20263b";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, h / 2 + 1, w - 20);
    ctx.restore();
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}
