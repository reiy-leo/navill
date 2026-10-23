/** 滚动到某个抽屉并闪一下边框；切换工作区后元素可能还没渲染，最多等 3 秒 */
export function revealDrawer(drawerId: string) {
  const start = performance.now();
  const tick = () => {
    const el = document.getElementById(`drawer-${drawerId}`);
    if (!el) {
      if (performance.now() - start < 3000) requestAnimationFrame(tick);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    const card = el.querySelector<HTMLElement>('.nv-drawer') ?? el;
    card.classList.remove('nv-flash');
    void card.offsetWidth; // 重新触发动画
    card.classList.add('nv-flash');
    setTimeout(() => card.classList.remove('nv-flash'), 1800);
  };
  requestAnimationFrame(tick);
}
