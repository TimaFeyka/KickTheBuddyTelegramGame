/* Global leaderboard. */

import { el, toast, setModalBody, sectionTitle, button } from "./ui.js";
import { t, fmt } from "./i18n.js";
import { tgUser, haptic, shareScore, gameRequest } from "./telegram.js";
import { audio } from "./audio.js";

const medals = ["🥇", "🥈", "🥉"];

export function buildBoard(ctx) {
  const { store, demoMode } = ctx;
  let period = "all";
  let rows = null;
  let stats = null;
  let error = null;
  let requestGeneration=0;

  const wrap = el("div");
  const listNode = el("div");
  const tabs = el("div", { class: "tabs" });

  const renderTabs = () => {
    tabs.innerHTML = "";
    [
      { id: "all", label: t("allTime") },
      { id: "week", label: t("thisWeek") },
    ].forEach((item) => {
      tabs.append(
        el("button", {
          class: `tab ${period === item.id ? "active" : ""}`.trim(),
          text: item.label,
          onclick: async () => {
            period = item.id;
            renderTabs();
            await load();
          },
        })
      );
    });
  };

  const render = () => {
    listNode.innerHTML = "";
    if (stats) {
      listNode.append(
        el("div", { class: "preview-strip" }, [
          el("div", { class: "pv-emoji", text: "🌍" }),
          el("div", { class: "pv-text" }, [
            el("b", { text: t("season") }),
            el("span", {
              text: `${fmt(stats.players)} ${t("players")} · ${fmt(stats.damage)} ${t("damage")} · ${fmt(stats.kos)} K.O.`,
            }),
          ]),
        ])
      );
    }

    if (error) {
      listNode.append(el("div", { class: "hintline", text: demoMode ? t("demoNote") : t("loadError") }));
      listNode.append(
        button(`↻ ${t("retry")}`, { variant: "ghost", onClick: () => load() })
      );
      return;
    }
    if (!rows) {
      listNode.append(el("div", { class: "card-sub", text: "…", style: { padding: "20px", textAlign: "center" } }));
      return;
    }
    if (!rows.length) {
      listNode.append(el("div", { class: "hintline", text: t("noScores") }));
    }
    const me = tgUser()?.id;
    rows.forEach((row) => {
      const mine = row.mine === true;
      listNode.append(
        el("div", { class: `lb-row ${mine ? "me" : ""}`.trim() }, [
          el("div", { class: "lb-place", text: medals[row.place - 1] || String(row.place) }),
          el("div", { class: "lb-name" }, [
            el("div", { text: row.name || t("player") }),
            el("div", { class: "lb-sub", text: `${t("bestLabel")}: ${fmt(row.bestRound)} · ${row.bestCombo || 0}×` }),
          ]),
          el("div", { class: "lb-score", text: fmt(row.totalDamage) }),
        ])
      );
    });

    const statNode = el("div", { class: "field", style: { marginTop: "14px" } }, [
      el("label", {}, [
        el("span", { text: t("stats") }),
        el("b", { text: `${fmt(store.state.stats.totalDamage)}` }),
      ]),
      el("div", { class: "row", style: { justifyContent: "space-between" } }, [
        el("span", { class: "card-sub", text: `${t("bestCombo")}: ${store.state.stats.bestCombo}×` }),
        el("span", { class: "card-sub", text: `${t("roundsPlayed")}: ${store.state.stats.rounds}` }),
      ]),
    ]);
    listNode.append(statNode);
    listNode.append(
      button(`🔗 ${t("shareScore")}`, {
        variant: "ghost",
        onClick: () => {
          const text = t("shareText", { n: fmt(store.state.stats.totalDamage) });
          if (!shareScore(store.state.stats.totalDamage, text)) toast(t("shareUnsupported"), "bad");
        },
      })
    );
  };

  async function load() {
    const generation=++requestGeneration;
    rows = null;
    error = null;
    render();
    try {
      const [lb,st]=await Promise.all([gameRequest('leaderboard?period='+period),gameRequest('stats')]);
      if(generation!==requestGeneration)return;
      rows = lb.rows || [];
      stats = st.stats || null;
      audio.sfx("click");
      haptic("select");
    } catch {
      if(generation!==requestGeneration)return;
      error = true;
      rows = [];
    }
    render();
  }

  renderTabs();
  wrap.append(tabs, listNode);
  render();
  load();
  return wrap;
}

export function refreshBoard(ctx) {
  setModalBody(buildBoard(ctx));
}
