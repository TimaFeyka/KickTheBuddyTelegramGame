/* Settings sheet: audio, language, stats, sharing, reset. */

import { el, toast, setModalBody, sectionTitle, toggle, button, closeModal } from "./ui.js";
import { t, fmt, LANGS, langLabel } from "./i18n.js";
import { audio } from "./audio.js";
import { haptic, shareScore, tgUser } from "./telegram.js";

export function buildSettings(ctx) {
  const { store, applySettings, applyLanguage, applyVoice, refresh, demoMode } = ctx;
  const wrap = el("div");
  const settings = store.state.settings;
  const stats = store.state.stats;

  /* language */
  const langGrid = el("div", { class: "row wrap" });
  for (const lang of LANGS) {
    const active = (settings.lang === "auto"
      ? (tgUser()?.language_code || "en").slice(0, 2)
      : settings.lang) === lang.code;
    langGrid.append(
      el("button", {
        class: `btn sm ${active ? "primary" : "ghost"}`.trim(),
        text: lang.label,
        onclick: async () => {
          store.setSetting("lang", lang.code);
          await applyLanguage(lang.code);
          audio.sfx("click");
          haptic("select");
          refreshAll();
        },
      })
    );
  }
  wrap.append(
    el("div", { class: "field" }, [
      el("label", {}, [el("span", { text: t("language") }), el("b", { text: langLabel(settings.lang === "auto" ? "en" : settings.lang) })]),
      langGrid,
    ])
  );

  /* toggles */
  wrap.append(sectionTitle(t("settings")));
  const soundToggle = toggle({
    label: t("sound"),
    on: settings.sound !== false,
    onChange: (on) => {
      store.setSetting("sound", on);
      audio.sfx("click");
      applySettings();
    },
  });
  const musicToggle = toggle({
    label: t("music"),
    on: settings.music !== false,
    onChange: (on) => {
      store.setSetting("music", on);
      applySettings();
    },
  });
  const hapticToggle = toggle({
    label: t("haptics"),
    on: settings.haptics !== false,
    onChange: (on) => {
      store.setSetting("haptics", on);
      applySettings();
      haptic("light");
    },
  });
  const numbersToggle = toggle({
    label: t("damageNumbers"),
    on: settings.damageNumbers !== false,
    onChange: (on) => {
      store.setSetting("damageNumbers", on);
      applySettings();
    },
  });
  const glowToggle = toggle({
    label: t("reduceMotion"),
    on: Boolean(settings.reduceGlow),
    onChange: (on) => {
      store.setSetting("reduceGlow", on);
      applySettings();
    },
  });
  wrap.append(el("div", { class: "stack" }, [soundToggle, musicToggle, hapticToggle, numbersToggle, glowToggle]));

  /* stats */
  wrap.append(sectionTitle(t("stats")));
  const rows = [
    [t("totalDamage"), fmt(stats.totalDamage)],
    [t("bestCombo"), `${stats.bestCombo}×`],
    [t("roundsPlayed"), fmt(stats.rounds)],
    [t("knockouts"), fmt(stats.kos)],
  ];
  const statBox = el(
    "div",
    { class: "field", style: { gap: "8px" } },
    rows.map(([label, value]) =>
      el("div", { class: "row", style: { justifyContent: "space-between" } }, [
        el("span", { class: "card-sub", text: label }),
        el("b", { text: value }),
      ])
    )
  );
  wrap.append(statBox);

  wrap.append(
    button(`🔗 ${t("shareScore")}`, {
      variant: "ghost",
      onClick: () => {
        const text = t("shareText", { n: fmt(stats.totalDamage) });
        if (!shareScore(stats.totalDamage, text)) toast(t("shareUnsupported"), "bad");
        haptic("success");
      },
    })
  );

  if (demoMode) {
    wrap.append(el("div", { class: "hintline", text: t("demoNote"), style: { marginTop: "10px" } }));
  }

  /* reset */
  wrap.append(sectionTitle(t("reset")));
  const confirmRow = el("div", { class: "row", style: { display: "none" } }, [
    button(t("confirm"), {
      variant: "danger",
      onClick: async () => {
        if (!await store.reset()) {toast("Не удалось сохранить сброс. Проверьте соединение.", "bad");return;}
        closeModal();
        location.reload();
      },
    }),
    button(t("cancel"), { variant: "ghost", onClick: () => (confirmRow.style.display = "none") }),
  ]);
  wrap.append(
    button(`⚠️ ${t("reset")}`, {
      variant: "danger",
      onClick: () => {
        confirmRow.style.display = "";
      },
    }),
    el("div", { text: t("resetConfirm"), class: "card-sub", style: { margin: "8px 2px" } }),
    confirmRow
  );

  wrap.append(
    el("div", {
      class: "hintline",
      style: { marginTop: "16px", textAlign: "center" },
      text: "Пни профессора · v1.0 · Telegram и MAX",
    })
  );

  function refreshAll() {
    setModalBody(buildSettings(ctx));
  }

  return wrap;
}

export function refreshSettings(ctx) {
  setModalBody(buildSettings(ctx));
}
