import { useEffect, useRef } from "react";

const stack = [];
let buf = "";
let last = 0;
let start = 0;
let snap = null;

function snapshot() {
  const el = document.activeElement;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return { el, value: el.value };
  return null;
}

function restore() {
  if (!snap || snap.el.value === snap.value) return;
  const proto = snap.el.tagName === "INPUT" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(snap.el, snap.value);
  snap.el.dispatchEvent(new Event("input", { bubbles: true }));
}

function onKeyDown(e) {
  if (!stack.length) return;
  const now = performance.now();
  if (e.key === "Enter") {
    if (buf.length >= 4 && (now - start) / buf.length < 45) {
      e.preventDefault();
      e.stopPropagation();
      const code = buf;
      restore();
      buf = "";
      snap = null;
      stack[stack.length - 1].current(code);
    } else buf = "";
    return;
  }
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  if (now - last > 60) {
    buf = "";
    start = now;
    snap = snapshot();
  }
  buf += e.key;
  last = now;
}

window.addEventListener("keydown", onKeyDown, true);

export function useScanner(handler, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    stack.push(ref);
    return () => {
      const i = stack.lastIndexOf(ref);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}
