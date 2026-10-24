/* Shop: weapons and permanent upgrades. */

import { WEAPONS, UPGRADES, upgradeCost, weaponLabel, upgradeName } from "./content.js";
import { t, fmt } from "./i18n.js";
import { audio } from "./audio.js";
import { haptic } from "./telegram.js";
import { el, card, button, toast, setModalBody, sectionTitle } from "./ui.js";
import { weaponIcon } from "./weaponry.js";

const UPGRADE_KEY = { power: "power", crit: "crit", coins: "coinBonus", tough: "toughness" };

export function buildShop(ctx) {
  const { store, refresh, onEquip } = ctx;
  let tab = "weapons";

  const wrap = el("div");
  const tabs = el("div", { class: "tabs" });
  const content = el("div");

  const renderTabs = () => {
    tabs.innerHTML = "";
    [
      { id: "weapons", label: t("weapons") },
      { id: "upgrades", label: t("upgrades") },
    ].forEach((item) => {
      tabs.append(
        el("button", {
          class: `tab ${tab === item.id ? "active" : ""}`.trim(),
          text: item.label,
          onclick: () => {
            tab = item.id;
            audio.sfx("click");
            renderTabs();
            renderContent();
          },
        })
      );
    });
  };

  const renderContent = () => {
    content.innerHTML = "";
    content.append(
      el("div", { class: "preview-strip" }, [
        el("div", { class: "pv-emoji", text: "🪙" }),
        el("div", { class: "pv-text" }, [
          el("b", { text: `${fmt(store.coins)} ${t("coins")}` }),
          el("span", { text: t("shopHint") }),
        ]),
      ])
    );
    if (tab === "weapons") renderWeapons();
    else renderUpgrades();
  };

  const renderWeapons = () => {
    content.append(sectionTitle(t("weapons")));
    const grid = el("div", { class: "grid" });
    for (const weapon of WEAPONS) {
      const owned = store.owns(weapon.id);
      const equipped = store.state.equipped === weapon.id;
      const affordable = store.coins >= weapon.price;
      const icon = weaponIcon(weapon.rig, 110);
      grid.append(
        card({
          title: weaponLabel(weapon, document.documentElement.lang),
          subtitle: `${Math.round(weapon.damage)} ${t("damageShort")} · ${(weapon.cooldown / 1000).toFixed(2)} ${t("secondsShort")}`,
          thumb: icon || null,
          icon: icon ? "" : weapon.emoji,
          selected: equipped,
          locked: !owned,
          price: owned
            ? equipped
              ? `✓ ${t("equipped")}`
              : t("equip")
            : `${fmt(weapon.price)} 🪙`,
          priceState: owned ? "owned" : affordable ? "" : "poor",
          onClick: () => {
            if (owned) {
              store.equip(weapon.id);
              audio.sfx("click");
              haptic("select");
              toast(t("weaponEquipped", { name: weaponLabel(weapon, document.documentElement.lang) }), "good");
              onEquip?.(weapon.id);
            } else if (store.spend(weapon.price)) {
              store.unlockWeapon(weapon.id);
              store.equip(weapon.id);
              audio.sfx("level");
              haptic("success");
              toast(t("purchased", { name: weaponLabel(weapon, document.documentElement.lang) }), "good");
              onEquip?.(weapon.id);
            } else {
              audio.sfx("error");
              haptic("error");
              toast(t("notEnough"), "bad");
              return;
            }
            renderContent();
            refresh?.();
          },
        })
      );
    }
    content.append(grid);
    content.append(el("div", { class: "hintline", text: t("lockedHint"), style: { marginTop: "14px" } }));
  };

  const renderUpgrades = () => {
    content.append(sectionTitle(t("upgrades")));
    const stack = el("div", { class: "stack" });
    for (const def of UPGRADES) {
      const level = store.upgradeLevel(def.id);
      const maxed = level >= def.max;
      const cost = upgradeCost(def, level);
      const affordable = store.coins >= cost;
      const pct = Math.round((level / def.max) * 100);
      const row = el("div", { class: "field" }, [
        el("label", {}, [
          el("span", { text: `${def.emoji} ${t(UPGRADE_KEY[def.id])}  ·  ${t("level", { n: level })}` }),
          el("b", { text: `${level}/${def.max}` }),
        ]),
        el("div", {
          style: {
            height: "6px",
            borderRadius: "99px",
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          },
        }, [
          el("i", {
            style: {
              display: "block",
              height: "100%",
              width: `${pct}%`,
              background: "linear-gradient(90deg,#ffd35c,#ff7a3d)",
              borderRadius: "99px",
              transition: "width .25s ease",
            },
          }),
        ]),
        el("div", { class: "row", style: { justifyContent: "space-between", marginTop: "4px" } }, [
          el("span", { class: "card-sub", text: t({power:"powerDesc",crit:"critDesc",coins:"coinDesc",tough:"toughDesc"}[def.id]) }),
          maxed
            ? el("span", { class: "price owned", text: t("max") })
            : button(`${fmt(cost)} 🪙`, {
                variant: affordable ? "primary sm" : "ghost sm",
                onClick: () => {
                  if (!store.spend(cost)) {
                    audio.sfx("error");
                    haptic("error");
                    toast(t("notEnough"), "bad");
                    return;
                  }
                  store.setUpgrade(def.id, level + 1);
                  audio.sfx("level");
                  haptic("success");
                  toast(t("upgradeDone", { name: t(UPGRADE_KEY[def.id]) }), "good");
                  renderContent();
                  refresh?.();
                },
              }),
        ]),
      ]);
      stack.append(row);
    }
    content.append(stack);
  };

  renderTabs();
  wrap.append(tabs, content);
  renderContent();
  return wrap;
}

export function refreshShop(ctx) {
  setModalBody(buildShop(ctx));
}
