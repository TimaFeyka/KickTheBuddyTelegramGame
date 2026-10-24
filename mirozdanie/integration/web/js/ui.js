/* UI toolkit: tiny DOM helper, modal sheet, toasts. */

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key === "style" && typeof value === "object") Object.assign(node.style, value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

const modalRoot = () => document.getElementById("modalRoot");
const modalEl = () => document.getElementById("modal");
const titleEl = () => document.getElementById("modalTitle");
const bodyEl = () => document.getElementById("modalBody");

let isOpen = false;
let onCloseCallback = null;

export function openModal({ title, body, onClose, wide = false }) {
  const root = modalRoot();
  titleEl().textContent = title || "";
  const host = bodyEl();
  host.innerHTML = "";
  if (body) host.append(body);
  modalEl().style.maxWidth = wide ? "640px" : "560px";
  root.hidden = false;
  requestAnimationFrame(() => {
    root.classList.add("open");
    bodyEl().scrollTop = 0;
  });
  isOpen = true;
  onCloseCallback = onClose || null;
}

export function setModalBody(node) {
  const body = bodyEl();
  body.innerHTML = "";
  if (node) body.append(node);
  body.scrollTop = 0;
}

export function closeModal() {
  const root = modalRoot();
  if (!isOpen) return;
  isOpen = false;
  root.classList.remove("open");
  const callback = onCloseCallback;
  onCloseCallback = null;
  setTimeout(() => {
    if (!root.classList.contains("open")) root.hidden = true;
  }, 280);
  if (callback) callback();
}

export function modalOpen() {
  return isOpen;
}

export function initModal() {
  document.getElementById("modalClose")?.addEventListener("click", () => closeModal());
  document.getElementById("modalBackdrop")?.addEventListener("click", () => closeModal());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen) closeModal();
  });
}

/* ── toasts ─────────────────────────────────────────────────────────────── */

export function toast(message, kind = "") {
  const root = document.getElementById("toastRoot");
  if (!root) return;
  const node = el("div", { class: `toast ${kind}`.trim(), text: message });
  root.append(node);
  setTimeout(() => {
    node.classList.add("leaving");
    setTimeout(() => node.remove(), 260);
  }, 2300);
  while (root.children.length > 3) root.firstChild.remove();
}

/* ── common widgets ─────────────────────────────────────────────────────── */

export function sectionTitle(text, extra) {
  return el("div", { class: "section-title" }, [el("span", { text }), extra]);
}

export function slider({ label, value, min = 0, max = 100, step = 1, onInput, format }) {
  const output = el("b", { text: format ? format(value) : String(value) });
  const input = el("input", {
    type: "range",
    min,
    max,
    step,
    value,
    oninput: (event) => {
      const v = Number(event.target.value);
      output.textContent = format ? format(v) : String(v);
      onInput?.(v);
    },
  });
  return el("div", { class: "field" }, [el("label", { text: label }, [output]), input]);
}

export function toggle({ label, on, onChange, hint }) {
  const node = el(
    "button",
    {
      type: "button",
      class: `switch ${on ? "on" : ""}`,
      role: "switch",
      "aria-checked": on ? "true" : "false",
      onclick: () => {
        const next = !node.classList.contains("on");
        node.classList.toggle("on", next);
        node.setAttribute("aria-checked", next ? "true" : "false");
        onChange?.(next);
      },
    },
    [
      el("span", {}, [
        el("span", { text: label }),
        hint ? el("div", { class: "card-sub", text: hint, style: { marginTop: "2px" } }) : null,
      ]),
      el("span", { class: "knob" }),
    ]
  );
  return node;
}

export function button(label, { variant = "", onClick, icon } = {}) {
  return el(
    "button",
    { class: `btn ${variant}`.trim(), onclick: onClick },
    [icon ? el("span", { text: icon }) : null, el("span", { text: label })]
  );
}

export function priceTag(text, state = "") {
  return el("span", { class: `price ${state}`.trim(), text });
}

export function card({ title, subtitle, icon, price, priceState, selected, locked, thumb, onClick }) {
  return el(
    "button",
    {
      class: `card ${selected ? "selected" : ""} ${locked ? "locked" : ""}`.trim(),
      onclick: onClick,
    },
    [
      thumb ? el("div", { class: "thumb", style: { backgroundImage: `url("${thumb}")` } }) : null,
      el("div", { class: "card-title" }, [icon ? el("span", { text: icon }) : null, el("span", { text: title })]),
      subtitle ? el("div", { class: "card-sub", text: subtitle }) : null,
      price ? priceTag(price, priceState) : null,
    ]
  );
}
