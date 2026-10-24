/* Kick the Professor — application bootstrap. */

import { store } from "./store.js";
import {
  initTelegram,
  tgUser,
  initData,
  haptic,
  platform, gameRequest, closeApp, embedded, setHapticsEnabled,
} from "./telegram.js";
import { setLang, applyTranslations, t, fmt } from "./i18n.js";
import { fetchConfig, loadImage, findAsset } from "./assets.js";
import { Game } from "./game.js";
import { audio } from "./audio.js";
import { WEAPONS, WEAPON_BY_ID, BUILTIN_VOICES, weaponLabel } from "./content.js";
import { weaponIcon } from "./weaponry.js";
import { openModal, closeModal, initModal, toast, el, modalOpen } from "./ui.js";
import { buildShop } from "./shop.js";
import { buildStudio, cancelRecording } from "./studio.js";
import { buildSettings } from "./settings.js";
import { buildBoard } from "./board.js";

const dom = {
  canvas: document.getElementById("game"),
  hpFill: document.getElementById("hpFill"),
  hpText: document.getElementById("hpText"),
  comboBadge: document.getElementById("comboBadge"),
  round: document.getElementById("hudRound"),
  coinCount: document.getElementById("coinCount"),
  coinPill: document.getElementById("coinPill"),
  rageBanner: document.getElementById("rageBanner"),
  weaponLabel: document.getElementById("weaponLabel"),
  dock: document.getElementById("dock"),
  stageHint: document.getElementById("stageHint"),
  shopDot: document.getElementById("shopDot"),
  avatar: document.getElementById("hudAvatar"),
  splash: document.getElementById("splash"),
  splashHint: document.getElementById("splashHint"),
};

let manifest = { backgrounds: [], faces: [], dolls: [], voicePacks: [] };
let demoMode = true;
let game = null;
let lastCoins = 0;
let bestSeen = 0;
let currentLang = "ru";

/* ── boot ───────────────────────────────────────────────────────────────── */

async function boot() {
  initTelegram();
  initModal();
  await store.load();

  currentLang = store.state.settings.lang || "ru";
  store.state.settings.lang = currentLang;
  const activeLang =
    currentLang === "auto"
      ? (tgUser()?.language_code || navigator.language || "ru").slice(0, 2)
      : currentLang;
  setLang(activeLang);
  applyTranslations();

  const cfg = await fetchConfig();
  manifest = cfg.assets;
  demoMode = Boolean(store.session?.demoIdentity);
  if (store.isFresh && Number.isFinite(cfg.startCoins)) {
    store.state.coins = Math.max(0, Math.round(cfg.startCoins));
    store.save();
  }

  game = new Game(dom.canvas, {
    store,
    onHud: updateHud,
    onRoundEnd: handleRoundEnd,
    onMilestone: handleMilestone,
  }).mount();

  applySettings();
  renderDock();
  bindActions();
  await applyCosmetics();
  await applyVoice();

  lastCoins = store.state.coins;
  bestSeen = store.state.stats.bestRound;
  updateCoins(true);
  game.start();
  installHostNavigation();

  // splash out
  setTimeout(() => {
    dom.splash.classList.add("hidden");
    if (store.state.seen.intro) dom.stageHint?.classList.add("gone");
    else {
      setTimeout(() => dom.stageHint?.classList.add("gone"), 8000);
    }
  }, 550);
  if (dom.splashHint) dom.splashHint.textContent = demoMode ? "Локальная игра" : "Игротека Мироздания";

  window.addEventListener("pagehide", () => {store.save();store.flush();});
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {store.save();store.flush();}
  });

  // first interaction unlocks audio + marks the tutorial as seen
  const unlock = () => {
    audio.init();
    audio.setEnabled(store.state.settings.sound !== false);
    if (store.state.settings.music !== false) audio.setMusicEnabled(true);
    store.state.seen.intro = true;
    store.save();
    dom.stageHint?.classList.add("gone");
    window.removeEventListener("pointerdown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });

  window.addEventListener("pointerdown", () => audio.init());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modalOpen()) return;
  });
}

/* ── HUD ────────────────────────────────────────────────────────────────── */

function updateHud(state) {
  const pct = Math.max(0, Math.min(100, (state.hp / state.maxHp) * 100));
  document.querySelector(".hp-bar")?.setAttribute("aria-valuenow",String(Math.round(pct)));
  dom.hpFill.style.width = `${pct}%`;
  dom.hpFill.classList.toggle("low", pct < 25);
  dom.hpText.textContent = `${Math.ceil(state.hp)} / ${Math.round(state.maxHp)}`;

  const comboOn = state.combo > 1;
  dom.comboBadge.classList.toggle("on", comboOn);
  if (comboOn) {
    dom.comboBadge.innerHTML = `${t("combo")} <b>×${state.combo}</b>`;
    dom.comboBadge.classList.toggle("big", state.combo % 10 === 0);
  }

  dom.round.textContent = t("round", { n: state.round });
  dom.rageBanner.hidden = !state.rageActive;

  const weapon = WEAPON_BY_ID[state.weapon];
  if (weapon) {
    dom.weaponLabel.textContent = `${weapon.emoji} ${weaponLabel(weapon, currentLang === "auto" ? document.documentElement.lang : currentLang)}`;
  }

  updateCoins();
  for (const button of dom.dock.querySelectorAll("[data-weapon]")) {
    const id = button.dataset.weapon;
    const ratio = state.cooldowns?.[id] || 0;
    const fill = button.querySelector(".cool");
    if (fill) fill.style.height = `${Math.round(ratio * 100)}%`;
  }
}

function updateCoins(force = false) {
  const coins = store.state.coins;
  dom.coinCount.textContent = fmt(coins);
  if (coins !== lastCoins || force) {
    if (coins > lastCoins && !force) {
      dom.coinPill.classList.remove("bump");
      void dom.coinPill.offsetWidth;
      dom.coinPill.classList.add("bump");
    }
    lastCoins = coins;
    renderDockStates();
  }
}

/* ── weapon dock ────────────────────────────────────────────────────────── */

function renderDock() {
  dom.dock.innerHTML = "";
  for (const weapon of WEAPONS) {
    const button = el("button", {
      class: "weapon",
      dataset: { weapon: weapon.id },
      "aria-label": weaponLabel(weapon, displayLang()),
      onclick: () => onWeaponClick(weapon.id),
    });
    const icon = weaponIcon(weapon.rig, 72);
    button.innerHTML = `
      ${icon
        ? `<img class="wicon" src="${icon}" alt="" draggable="false" />`
        : `<span class="emoji">${weapon.emoji}</span>`}
      <span class="wname">${weaponLabel(weapon, displayLang())}</span>
      <div class="cool"></div>
    `;
    dom.dock.append(button);
  }
  renderDockStates();
}

function renderDockStates() {
  const equipped = game?.weaponId || store.state.equipped;
  for (const button of dom.dock.querySelectorAll("[data-weapon]")) {
    const id = button.dataset.weapon;
    const owned = store.owns(id);
    const weapon = WEAPON_BY_ID[id];
    button.classList.toggle("active", id === equipped);
    button.classList.toggle("locked", !owned);
    button.classList.toggle("affordable", !owned && store.coins >= weapon.price);
  }
  const anyAffordable = WEAPONS.some((w) => !store.owns(w.id) && store.coins >= w.price);
  if (dom.shopDot) dom.shopDot.hidden = !anyAffordable;
}

function onWeaponClick(id) {
  const weapon = WEAPON_BY_ID[id];
  if (!owned(id)) {
    audio.sfx("click");
    haptic("select");
    openShop();
    return;
  }
  game.setWeapon(id);
  store.equip(id);
  audio.sfx("click");
  haptic("select");
  renderDockStates();
  game.previewWeapon(id);
  if (dom.weaponLabel) dom.weaponLabel.textContent = `${weapon.emoji} ${weaponLabel(weapon, displayLang())}`;
}

const owned = (id) => store.state.owned.includes(id);
const displayLang = () =>
  currentLang === "auto" ? document.documentElement.lang.slice(0, 2) : currentLang;

/* ── cosmetics ──────────────────────────────────────────────────────────── */

async function applyCosmetics() {
  const cosmetics = store.state.cosmetics || {};
  const custom = store.state.customAssets || {};

  // face
  let faceImage = null;
  let faceMeta = null;
  if (cosmetics.face === "custom" && custom.face) {
    faceImage = await loadImage(custom.face);
    faceMeta = { scale: 1 };
  } else if (cosmetics.face && cosmetics.face !== "cartoon") {
    const asset = findAsset(manifest, "face", cosmetics.face);
    if (asset) {
      faceImage = await loadImage(asset.url);
      faceMeta = asset;
    }
  }
  game.setFace(faceImage, faceMeta);
  if (dom.avatar) {
    dom.avatar.innerHTML = "";
    if (faceImage) {
      const img = el("img", { src: faceImage.src, alt: "" });
      dom.avatar.append(img);
    } else {
      dom.avatar.textContent = "👨‍🏫";
    }
  }

  // body image
  let dollImage = null;
  let dollMeta = null;
  if (cosmetics.doll === "custom" && custom.doll) {
    dollImage = await loadImage(custom.doll);
    dollMeta = { height: 520, pivotY: 0.5 };
  } else if (cosmetics.doll) {
    const asset = findAsset(manifest, "doll", cosmetics.doll);
    if (asset) {
      dollImage = await loadImage(asset.url);
      dollMeta = asset;
    }
  }
  game.setDoll(dollImage, dollMeta);

  // background
  let bgImage = null;
  let bgMeta = null;
  if (cosmetics.background === "custom" && custom.background) {
    bgImage = await loadImage(custom.background);
  } else if (cosmetics.background && cosmetics.background !== "classroom") {
    const asset = findAsset(manifest, "background", cosmetics.background);
    if (asset) {
      bgImage = await loadImage(asset.url);
      bgMeta = asset;
    }
  }
  game.setBackground(bgImage, bgMeta);
}

async function applyVoice() {
  const choice = store.state.cosmetics?.voice || "builtin:professor";
  if (choice === "custom") {
    audio.configureVoice({
      type: "custom",
      useCustom: true,
      fallback: "builtin",
      id: "professor",
      pitch: 0.78,
      rate: 0.92,
    });
    audio.setPackClips({});
    return;
  }
  if (choice.startsWith("pack:")) {
    const id = choice.slice(5);
    const pack = (manifest.voicePacks || []).find((item) => item.id === id);
    if (pack) {
      audio.configureVoice({
        type: "pack",
        id: pack.id,
        pitch: pack.pitch || 1,
        fallback: "builtin",
      });
      audio.setPackClips(pack.clips || {});
      return;
    }
  }
  const builtinId = choice.replace("builtin:", "");
  const preset = BUILTIN_VOICES.find((item) => item.id === builtinId) || BUILTIN_VOICES[0];
  const pitchScale = store.state.cosmetics?.voicePitch || 1;
  audio.configureVoice({
    type: "builtin",
    id: preset.id,
    pitch: preset.pitch * pitchScale,
    rate: preset.rate,
    useCustom: false,
  });
  audio.setPackClips({});
}

function applySettings() {
  setHapticsEnabled(store.state.settings.haptics);
  game.applySettings(store.state.settings);
  game.refreshStats();
  audio.setEnabled(store.state.settings.sound !== false);
  if (store.state.settings.music === false) audio.stopMusic();
  else if (audio.ctx) audio.setMusicEnabled(true);
}

async function applyLanguage(code) {
  currentLang = code;
  store.setSetting("lang", code);

  const active =
    code === "auto" ? (tgUser()?.language_code || navigator.language || "ru").slice(0, 2) : code;
  setLang(active);
  applyTranslations();
  if (game) game.weaponId = game.weaponId;
  renderDock();
  updateCoins(true);
  if (game) game.refreshStats();
}

/* ── modals ─────────────────────────────────────────────────────────────── */

const baseCtx = () => ({
  store,
  manifest,
  demoMode,
  game,
  applyCosmetics,
  applyVoice,
  applySettings,
  applyLanguage,
  refresh: () => {
    updateCoins();
    renderDockStates();
  },
});

function openShop() {
  audio.sfx("open");
  haptic("select");
  openModal({
    title: `🛒 ${t("shop")}`,
    body: buildShop({
      ...baseCtx(),
      refresh: () => {
        updateCoins();
        renderDockStates();
        applySettings();
      },
      onEquip: (id) => {
        game.setWeapon(id);
        renderDockStates();
      },
    }),
  });
}

function openStudio() {
  audio.sfx("open");
  haptic("select");
  openModal({
    title: `🎨 ${t("studio")}`,
    body: buildStudio({
      ...baseCtx(),
      refresh: () => {
        updateCoins();
        renderDockStates();
      },
    }),
    onClose: () => cancelRecording(),
  });
}

function openSettings() {
  audio.sfx("open");
  haptic("select");
  openModal({
    title: `⚙️ ${t("settings")}`,
    body: buildSettings(baseCtx()),
  });
}

function openBoard() {
  audio.sfx("open");
  haptic("select");
  openModal({ title: `🏆 ${t("leaderboard")}`, body: buildBoard(baseCtx()) });
}

function bindActions() {
  document.getElementById("btnShop")?.addEventListener("click", openShop);
  document.getElementById("btnStudio")?.addEventListener("click", openStudio);
  document.getElementById("btnSettings")?.addEventListener("click", openSettings);
  document.getElementById("btnBoard")?.addEventListener("click", openBoard);
  dom.canvas.addEventListener("pointerdown", () => {
    if (store.state.seen.intro) dom.stageHint?.classList.add("gone");
  });
}

/* ── rounds, scoring, telemetry ─────────────────────────────────────────── */

function handleRoundEnd(result) {
  const previousBest = store.state.stats.bestRound;
  store.recordRound({ damage: result.damage, combo: result.combo, ko: true });
  toast(`${t("roundOver", { n: result.round })} · +${fmt(result.coins)} 🪙`, "good");
  if (result.damage > previousBest && result.damage > 0) {
    setTimeout(() => toast(`🏅 ${t("best")}`, "good"), 900);
  }
  bestSeen = Math.max(bestSeen, result.damage);
  submitScore(result);
  updateCoins(true);
}

function handleMilestone(event) {
  if (event.type === "rage") {
    toast(`🔥 ${t("rage")}`, "good");
  }
}

async function submitScore(result) {
  if (!result?.damage) return;
  const score={requestId:crypto.randomUUID(),damage:Math.round(result.damage),combo:Math.round(result.combo),kos:1};
  try {await gameRequest('score',score);}
  catch {toast('Результат остался в личной статистике. Рейтинг не обновлён.', 'bad');}
}

function installHostNavigation() {
  const leave=async()=>{cancelRecording();store.save();await store.flush();game.stop();audio.stopMusic();closeApp();};
  const back=()=>{if(modalOpen()){closeModal();return;}leave();};
  document.getElementById('returnLibrary')?.addEventListener('click',event=>{event.preventDefault();back();});
  window.addEventListener('message',event=>{
    if(!embedded||event.origin!==location.origin||event.source!==window.parent)return;
    if(event.data?.type==='mirozdanie-kick-buddy-go-back')back();
  });
  window.addEventListener('kick-buddy-link-copied',()=>toast('Ссылка скопирована'));
  window.addEventListener('kick-buddy-save',event=>{
    const node=document.getElementById('saveStatus');if(!node)return;
    const status=event.detail.status;
    node.textContent=status==='saved'?'':status==='conflict'?'Игра открыта на другом устройстве. Обновите страницу, чтобы загрузить сохранение.':'Нет связи. Прогресс сохранён на этом устройстве.';
    node.hidden=status==='saved';
    if(status==='conflict'){game.pause();node.onclick=()=>location.reload();}
  });
}

/* ── go ─────────────────────────────────────────────────────────────────── */

boot().catch((error) => {
  console.error("[boot]", error);
  if (dom.splashHint) dom.splashHint.textContent = error?.status===401||error?.status===403 ? "Откройте Мироздание через бота Telegram или MAX и проверьте подписку. Нажмите, чтобы повторить." : "Не удалось загрузить игру. Нажмите, чтобы повторить.";
  dom.splash?.addEventListener("click", () => location.reload());
});

// Development handles contain game state only; no messenger credentials.
window.__KTP__ = {
  get game() {
    return game;
  },
  store,
  audio,
  get manifest() {
    return manifest;
  },
  platform, gameRequest, closeApp, embedded, setHapticsEnabled,
  closeModal,
};
