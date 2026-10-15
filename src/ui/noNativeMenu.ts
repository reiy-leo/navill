/**
 * 全局屏蔽浏览器默认右键菜单；Navill 自己的右键菜单不受影响。
 * 输入框、文本域、可编辑区域保留原生菜单，便于复制粘贴、拼写纠错。
 */
function editable(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLTextAreaElement) return !t.readOnly && !t.disabled;
  if (t instanceof HTMLInputElement) {
    return !t.readOnly && !t.disabled && !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image'].includes(t.type);
  }
  return false;
}

export function disableNativeContextMenu() {
  window.addEventListener('contextmenu', (e) => { if (!editable(e.target)) e.preventDefault(); }, { capture: true });
}

/**
 * 屏蔽在 Navill 页面里打开开发者工具的快捷键：F12、Ctrl+Shift+I/J/C、⌘⌥I/J/C。
 * 开发模式保留，方便调试；浏览器菜单里的入口无法屏蔽。
 */
export function disableDevtoolsShortcuts() {
  if (import.meta.env.DEV) return;
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    const combo = ((e.ctrlKey && e.shiftKey) || (e.metaKey && e.altKey)) && ['i', 'j', 'c'].includes(k);
    if (e.key === 'F12' || combo) { e.preventDefault(); e.stopPropagation(); }
  }, { capture: true });
}
