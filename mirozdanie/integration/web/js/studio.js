/* Studio: swap the Professor's face, the stage, the body and the voice. */

import { el, card, button, toast, setModalBody, sectionTitle, slider } from "./ui.js";
import { t, fmt } from "./i18n.js";
import { audio } from "./audio.js";
import { haptic } from "./telegram.js";
import { compressImage, pickFile } from "./assets.js";
import { BUILTIN_VOICES, voiceName } from "./content.js";
import {
  VOICE_EVENTS,
  VoiceRecorder,
  saveClip,
  deleteClip,
  loadClipBlob,
} from "./voicebox.js";

const recorder = new VoiceRecorder();
let recordingEvent = null;

export function buildStudio(ctx) {
  const { store, manifest, applyCosmetics, applyVoice } = ctx;
  let tab = "face";

  const wrap = el("div");
  const tabs = el("div", { class: "tabs" });
  const content = el("div");

  const rerender = () => {
    rebuildTabs();
    rebuildContent();
  };

  const rebuildTabs = () => {
    tabs.innerHTML = "";
    [
      { id: "face", label: `🙂 ${t("faces")}` },
      { id: "background", label: `🖼️ ${t("backgrounds")}` },
      { id: "doll", label: `🧍 ${t("dolls")}` },
      { id: "voice", label: `🎙️ ${t("voice")}` },
    ].forEach((item) => {
      tabs.append(
        el("button", {
          class: `tab ${tab === item.id ? "active" : ""}`.trim(),
          text: item.label,
          onclick: () => {
            tab = item.id;
            audio.sfx("click");
            rerender();
          },
        })
      );
    });
  };

  const rebuildContent = () => {
    content.innerHTML = "";
    if (tab === "face") content.append(faceTab());
    else if (tab === "background") content.append(backgroundTab());
    else if (tab === "doll") content.append(dollTab());
    else content.append(voiceTab());
  };

  const selectAndApply = async (slot, id, message) => {
    store.setCosmetic(slot, id);
    await applyCosmetics();
    audio.sfx("click");
    haptic("select");
    toast(message, "good");
    rerender();
    ctx.refresh?.();
  };

  const APPLIED_KEY = { face: "faceApplied", background: "bgApplied", doll: "select" };

  const uploadCard = (slot, { maxSide, mime }) =>
    el("div", { class: "stack", style: { marginTop: "10px" } }, [
      button(`📤 ${t("uploadImage")}`, {
        variant: "ghost",
        onClick: async () => {
          const file = await pickFile();
          if (!file) return;
          try {
            const dataUrl = await compressImage(file, { maxSide, mime });
            store.setCustomAsset(slot, dataUrl);
            await selectAndApply(slot, "custom", t(APPLIED_KEY[slot]));
          } catch (error) {
            console.warn(error);
            toast(t("notEnough"), "bad");
          }
        },
      }),
      el("div", { class: "hintline", text: t("uploadHint") }),
    ]);

  /* ── face ──────────────────────────────────────────────────────────── */

  const faceTab = () => {
    const wrapEl = el("div");
    wrapEl.append(
      el("div", { class: "preview-strip" }, [
        el("div", { class: "pv-emoji", text: "🙂" }),
        el("div", { class: "pv-text" }, [
          el("b", { text: t("faces") }),
          el("span", { text: store.state.cosmetics.face === "cartoon" ? t("resetFace") : store.state.cosmetics.face }),
        ]),
      ])
    );
    const grid = el("div", { class: "grid-3 grid" });
    grid.append(
      card({
        title: t("resetFace"),
        subtitle: t("drawnInCode"),
        icon: "🎨",
        selected: store.state.cosmetics.face === "cartoon",
        price: store.state.cosmetics.face === "cartoon" ? `✓ ${t("select")}` : t("select"),
        priceState: "owned",
        onClick: () => selectAndApply("face", "cartoon", t("faceApplied")),
      })
    );
    for (const face of manifest.faces || []) {
      grid.append(
        card({
          title: face.name,
          subtitle: t("photoFace"),
          thumb: face.url,
          selected: store.state.cosmetics.face === face.id,
          price: store.state.cosmetics.face === face.id ? `✓ ${t("select")}` : t("select"),
          priceState: "owned",
          onClick: () => selectAndApply("face", face.id, t("faceApplied")),
        })
      );
    }
    if (store.state.customAssets?.face) {
      grid.append(
        card({
          title: t("custom"),
          subtitle: t("yourUpload"),
          thumb: store.state.customAssets.face,
          selected: store.state.cosmetics.face === "custom",
          price: store.state.cosmetics.face === "custom" ? `✓ ${t("select")}` : t("select"),
          priceState: "owned",
          onClick: () => selectAndApply("face", "custom", t("faceApplied")),
        })
      );
    }
    wrapEl.append(grid);
    wrapEl.append(uploadCard("face", { maxSide: 720, mime: "image/webp" }));
    if (store.state.customAssets?.face) {
      wrapEl.append(
        button(`🗑️ ${t("delete")} ${t("custom")}`, {
          variant: "danger",
          onClick: async () => {
            store.setCustomAsset("face", null);
            if (store.state.cosmetics.face === "custom") store.setCosmetic("face", "cartoon");
            await applyCosmetics();
            rerender();
          },
        })
      );
    }
    return wrapEl;
  };

  /* ── background ────────────────────────────────────────────────────── */

  const backgroundTab = () => {
    const wrapEl = el("div");
    const grid = el("div", { class: "grid" });
    grid.append(
      card({
        title: t("resetBg"),
        subtitle: t("drawnInCode"),
        icon: "🏫",
        selected: store.state.cosmetics.background === "classroom",
        price: store.state.cosmetics.background === "classroom" ? `✓ ${t("select")}` : t("select"),
        priceState: "owned",
        onClick: () => selectAndApply("background", "classroom", t("bgApplied")),
      })
    );
    for (const bg of manifest.backgrounds || []) {
      grid.append(
        card({
          title: bg.name,
          subtitle: t("stage"),
          thumb: bg.url,
          selected: store.state.cosmetics.background === bg.id,
          price: store.state.cosmetics.background === bg.id ? `✓ ${t("select")}` : t("select"),
          priceState: "owned",
          onClick: () => selectAndApply("background", bg.id, t("bgApplied")),
        })
      );
    }
    if (store.state.customAssets?.background) {
      grid.append(
        card({
          title: t("custom"),
          subtitle: t("yourUpload"),
          thumb: store.state.customAssets.background,
          selected: store.state.cosmetics.background === "custom",
          price: store.state.cosmetics.background === "custom" ? `✓ ${t("select")}` : t("select"),
          priceState: "owned",
          onClick: () => selectAndApply("background", "custom", t("bgApplied")),
        })
      );
    }
    wrapEl.append(grid);
    wrapEl.append(uploadCard("background", { maxSide: 1400, mime: "image/jpeg" }));
    if (store.state.customAssets?.background) {
      wrapEl.append(
        button(`🗑️ ${t("delete")} ${t("custom")}`, {
          variant: "danger",
          onClick: async () => {
            store.setCustomAsset("background", null);
            if (store.state.cosmetics.background === "custom") store.setCosmetic("background", "classroom");
            await applyCosmetics();
            rerender();
          },
        })
      );
    }
    return wrapEl;
  };

  /* ── doll body ─────────────────────────────────────────────────────── */

  const dollTab = () => {
    const wrapEl = el("div");
    wrapEl.append(
      el("div", { class: "hintline", text: t("uploadHint"), style: { marginBottom: "12px" } })
    );
    const grid = el("div", { class: "grid" });
    grid.append(
      card({
        title: t("drawnProfessor"),
        subtitle: t("bodyAndCoat"),
        icon: "🎩",
        selected: !store.state.cosmetics.doll,
        price: !store.state.cosmetics.doll ? `✓ ${t("select")}` : t("select"),
        priceState: "owned",
        onClick: async () => {
          store.setCosmetic("doll", null);
          await applyCosmetics();
          rerender();
        },
      })
    );
    for (const doll of manifest.dolls || []) {
      grid.append(
        card({
          title: doll.name,
          subtitle: t("fullBody"),
          thumb: doll.url,
          selected: store.state.cosmetics.doll === doll.id,
          price: store.state.cosmetics.doll === doll.id ? `✓ ${t("select")}` : t("select"),
          priceState: "owned",
          onClick: () => selectAndApply("doll", doll.id, t("select")),
        })
      );
    }
    if (store.state.customAssets?.doll) {
      grid.append(
        card({
          title: t("custom"),
          subtitle: t("yourUpload"),
          thumb: store.state.customAssets.doll,
          selected: store.state.cosmetics.doll === "custom",
          price: store.state.cosmetics.doll === "custom" ? `✓ ${t("select")}` : t("select"),
          priceState: "owned",
          onClick: () => selectAndApply("doll", "custom", t("select")),
        })
      );
    }
    wrapEl.append(grid);
    wrapEl.append(uploadCard("doll", { maxSide: 800, mime: "image/webp" }));
    return wrapEl;
  };

  /* ── voice ─────────────────────────────────────────────────────────── */

  const voiceTab = () => {
    const wrapEl = el("div");
    wrapEl.append(
      el("div", { class: "preview-strip" }, [
        el("div", { class: "pv-emoji", text: "🎙️" }),
        el("div", { class: "pv-text" }, [
          el("b", { text: t("voiceStudio") }),
          el("span", { text: t("voiceHint") }),
        ]),
      ])
    );

    wrapEl.append(sectionTitle(t("autoVoice")));
    const voices = el("div", { class: "grid" });
    for (const preset of BUILTIN_VOICES) {
      const id = `builtin:${preset.id}`;
      voices.append(
        card({
          title: voiceName(preset, document.documentElement.lang),
          subtitle: `${preset.emoji} ${t("pitch")} ${preset.pitch.toFixed(2)}`,
          selected: store.state.cosmetics.voice === id,
          price: store.state.cosmetics.voice === id ? `✓ ${t("equipped")}` : t("select"),
          priceState: "owned",
          onClick: async () => {
            store.setCosmetic("voice", id);
            await applyVoice();
            audio.voice("taunt", { chance: 1 });
            rerender();
          },
        })
      );
    }
    wrapEl.append(voices);

    if (manifest.voicePacks?.length) {
      wrapEl.append(sectionTitle(t("installedVoices")));
      const packs = el("div", { class: "grid" });
      for (const pack of manifest.voicePacks) {
        const id = `pack:${pack.id}`;
        packs.append(
          card({
            title: pack.name,
            subtitle: `${pack.language?.toUpperCase?.() || "VO"} · ${Object.keys(pack.clips || {}).length} ${t("weapons") ? "clips" : ""}`,
            selected: store.state.cosmetics.voice === id,
            price: store.state.cosmetics.voice === id ? `✓ ${t("equipped")}` : t("select"),
            priceState: "owned",
            onClick: async () => {
              store.setCosmetic("voice", id);
              await applyVoice();
              audio.voice("hit", { chance: 1 });
              rerender();
            },
          })
        );
      }
      wrapEl.append(packs);
    }

    wrapEl.append(sectionTitle(t("custom")));
    const selfie = el(
      "button",
      {
        class: `card ${store.state.cosmetics.voice === "custom" ? "selected" : ""}`.trim(),
        onclick: async () => {
          store.setCosmetic("voice", "custom");
          await applyVoice();
          rerender();
        },
      },
      [
        el("div", { class: "card-title" }, [el("span", { text: "🎤" }), el("span", { text: t("myRecordings") })]),
        el("div", { class: "card-sub", text: t("yourClips") }),
        el("span", {
          class: `price ${store.state.cosmetics.voice === "custom" ? "owned" : ""}`.trim(),
          text: store.state.cosmetics.voice === "custom" ? `✓ ${t("equipped")}` : t("select"),
        }),
      ]
    );
    wrapEl.append(selfie);

    const recGrid = el("div", { class: "grid", style: { marginTop: "10px" } });
    for (const event of VOICE_EVENTS) {
      const cardEl = el("div", { class: "field" }, [
        el("label", {}, [
          el("span", { text: `${event.emoji} ${t(`voice_${event.id}`)}` }),
          el("b", { text: "" }),
        ]),
        el("div", { class: "row wrap" }, [
          el("button", {
            class: "btn sm ghost",
            text: recordingEvent === event.id ? `⏹ ${t("stop")}` : `⏺ ${t("record")}`,
            onclick: async () => {
              if (recordingEvent === event.id) {
                const blob = await recorder.stop();
                recordingEvent = null;
                if (blob) {
                  await saveClip(event.id, blob);
                  store.setCosmetic("voice", "custom");
                  await applyVoice();
                  audio.sfx("coin");
                  toast(t("savedVoice"), "good");
                }
                rerender();
                return;
              }
              try {
                recordingEvent = event.id;
                await recorder.start({ maxMs: 3200 });
                audio.sfx("click");
                rerender();
              } catch (error) {
                recordingEvent = null;
                toast(t("micDenied"), "bad");
                console.warn(error);
              }
            },
          }),
          el("button", {
            class: "btn sm ghost",
            text: `▶ ${t("test")}`,
            onclick: async () => {
              await applyVoice();
              audio.configureVoice({ type: "custom", useCustom: true, fallback: "builtin" });
              await audio.voice(event.id, { chance: 1 });
            },
          }),
          el("button", {
            class: "btn sm danger",
            text: "🗑",
            onclick: async () => {
              await deleteClip(event.id);
              rerender();
            },
          }),
        ]),
      ]);
      loadClipBlob(event.id).then((blob) => {
        const badge = cardEl.querySelector("b");
        if (badge) badge.textContent = blob ? `● ${t("recordedOk")}` : t("noClip");
      });
      recGrid.append(cardEl);
    }
    wrapEl.append(recGrid);
    wrapEl.append(
      slider({
        label: t("pitch"),
        value: Math.round((store.state.cosmetics.voicePitch || 1) * 100),
        min: 60,
        max: 160,
        step: 5,
        format: (v) => `${(v / 100).toFixed(2)}×`,
        onInput: (v) => {
          store.state.cosmetics.voicePitch = v / 100;
          store.commit();
          audio.configureVoice({ pitch: v / 100 });
        },
      })
    );
    void fmt;
    return wrapEl;
  };

  rebuildTabs();
  wrap.append(tabs, content);
  rebuildContent();
  return wrap;
}

export function refreshStudio(ctx) {
  setModalBody(buildStudio(ctx));
}

export function cancelRecording() {
  if (recordingEvent) {
    recorder.cancel();
    recordingEvent = null;
    return true;
  }
  return false;
}
