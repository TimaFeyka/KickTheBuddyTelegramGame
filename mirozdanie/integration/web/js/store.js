/* Persistent player profile: coins, unlocks, cosmetics, settings. */

import {ensureSession, gameRequest, setPlayer} from "./telegram.js";
import { UPGRADE_BY_ID } from "./content.js";

let KEY = null;

const defaults = () => ({
  v: 1,
  coins: 250,
  owned: ["kick", "punch"],
  equipped: "kick",
  upgrades: { power: 0, crit: 0, coins: 0, tough: 0 },
  cosmetics: {
    background: "classroom",
    face: "cartoon",
    doll: null,
    voice: "builtin:professor",
    voicePitch: 1,
  },
  customAssets: { background: null, face: null, doll: null },
  settings: {
    sound: true,
    music: true,
    haptics: true,
    damageNumbers: true,
    lang: "ru",
    reduceGlow: false,
  },
  stats: {
    bestRound: 0,
    bestCombo: 0,
    totalDamage: 0,
    kos: 0,
    rounds: 0,
  },
  seen: { intro: false, shop: false },
});

function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(base,key) || ["__proto__","constructor","prototype"].includes(key)) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      base[key] = deepMerge(base[key] && typeof base[key] === "object" ? base[key] : {}, value);
    } else if (value !== undefined && value !== null) {
      base[key] = value;
    }
  }
  return base;
}

export class Store {
  constructor() {
    this.state = defaults();
    this.listeners = new Set();
    this.saveTimer = null;
  }

  async load() {
    this.session = await ensureSession();
    const remote = await gameRequest('state');
    setPlayer(remote.player);
    KEY = 'mirozdanie.kick-buddy.v1.' + remote.player.id;
    this.revision = remote.revision;
    this.change = 0;
    this.dirty = false;
    let local;try {local=JSON.parse(localStorage.getItem(KEY)||'null');}catch{}
    this.isFresh = !remote.save;
    this.state = deepMerge(defaults(), remote.save);
    if (local?.save?.customAssets) this.state.customAssets=deepMerge(defaults().customAssets,local.save.customAssets);
    // Resume an offline write only if no newer server version has appeared.
    if(local?.dirty && local.revision===remote.revision) {
      this.state=deepMerge(defaults(),local.save);this.isFresh=false;this.dirty=true;this.save();
    }
    this.persist();
    window.addEventListener('online',()=>this.flush());
    return this.state;
  }

  persist() {
    if(!KEY)return;
    try {localStorage.setItem(KEY,JSON.stringify({revision:this.revision,dirty:this.dirty,save:this.state}));}catch{}
  }

  save() {
    this.change++;this.dirty=true;this.persist();
    if(!this.saveTimer&&!this.blocked)this.saveTimer=setTimeout(()=>{this.saveTimer=null;this.flush(false);},5000);
  }

  async flush(drain=true) {
    if(this.saving){const ok=await this.saving;return ok&&drain&&this.dirty?this.flush(true):ok;}
    if(!this.dirty||this.blocked)return !this.blocked;
    const change=this.change;
    const snapshot=JSON.parse(JSON.stringify(this.state));
    delete snapshot.customAssets; // User photos and recordings stay on this device.
    this.saving=(async()=>{
      try {
        const remote=await gameRequest('state',{save:snapshot,revision:this.revision},{keepalive:true});
        this.revision=remote.revision;this.dirty=this.change!==change;this.persist();
        window.dispatchEvent(new CustomEvent('kick-buddy-save',{detail:{status:'saved'}}));
        return true;
      } catch(error) {
        if(error.status===409)this.blocked=true;
        window.dispatchEvent(new CustomEvent('kick-buddy-save',{detail:{status:this.blocked?'conflict':'offline',error}}));
        return false;
      } finally {this.saving=null;}
    })();
    const ok=await this.saving;
    if(ok&&this.dirty){if(drain)return this.flush(true);if(!this.saveTimer)this.saveTimer=setTimeout(()=>{this.saveTimer=null;this.flush(false);},5000);}
    return ok;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    for (const fn of this.listeners) {
      try {
        fn(this.state);
      } catch (error) {
        console.error(error);
      }
    }
  }

  commit() {
    this.save();
    this.emit();
  }

  /* ── economy ─────────────────────────────────────────────────────────── */

  get coins() {
    return this.state.coins;
  }

  addCoins(amount) {
    const value = Math.max(0, Math.round(amount));
    this.state.coins = Math.max(0, this.state.coins + value);
    this.commit();
    return this.state.coins;
  }

  spend(amount) {
    const value = Math.max(0, Math.round(amount));
    if (this.state.coins < value) return false;
    this.state.coins -= value;
    this.commit();
    return true;
  }

  owns(id) {
    return this.state.owned.includes(id);
  }

  unlockWeapon(id) {
    if (!this.state.owned.includes(id)) this.state.owned.push(id);
    this.commit();
  }

  equip(id) {
    this.state.equipped = id;
    this.commit();
  }

  upgradeLevel(id) {
    return this.state.upgrades[id] || 0;
  }

  setUpgrade(id, level) {
    this.state.upgrades[id] = level;
    this.commit();
  }

  /* ── cosmetics ───────────────────────────────────────────────────────── */

  setCosmetic(slot, value) {
    this.state.cosmetics[slot] = value;
    this.commit();
  }

  setCustomAsset(slot, dataUrl) {
    this.state.customAssets[slot] = dataUrl;
    this.commit();
  }

  /* ── settings ────────────────────────────────────────────────────────── */

  setSetting(key, value) {
    this.state.settings[key] = value;
    this.commit();
  }

  setStat(key, value) {
    this.state.stats[key] = value;
  }

  recordRound({ damage, combo, ko }) {
    const stats = this.state.stats;
    stats.totalDamage += Math.round(damage);
    stats.bestRound = Math.max(stats.bestRound, Math.round(damage));
    stats.bestCombo = Math.max(stats.bestCombo, Math.round(combo));
    stats.rounds += 1;
    if (ko) stats.kos += 1;
    this.save();
  }

  async reset() {
    if(this.blocked)return false;
    if(!await this.flush())return false;
    const customAssets=this.state.customAssets;this.state=defaults();this.state.customAssets=customAssets;this.save();this.emit();
    return this.flush();
  }

  /* ── derived ─────────────────────────────────────────────────────────── */

  get damageMultiplier() {
    return 1 + this.upgradeLevel("power") * 0.08;
  }

  get critChance() {
    return this.upgradeLevel("crit") * 0.03;
  }

  get maxHp() {
    return 1000 + this.upgradeLevel("tough") * 200;
  }

  get coinMultiplier() {
    return 1 + this.upgradeLevel("coins") * 0.1;
  }

  nextUpgradeCost(id) {
    const def = UPGRADE_BY_ID[id];
    if (!def) return Infinity;
    return Math.round(def.baseCost * Math.pow(def.growth, this.upgradeLevel(id)));
  }
}

export const store = new Store();
