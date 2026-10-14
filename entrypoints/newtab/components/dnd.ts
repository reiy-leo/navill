export const DND_PLACEMENT = 'application/x-navill-placement';
export const DND_DRAWER = 'application/x-navill-drawer';
export const DND_WORKSPACE = 'application/x-navill-workspace';

export const hasType = (e: React.DragEvent, t: string) => Array.from(e.dataTransfer.types).includes(t);

/** 鼠标在元素后半部分时插到后面 */
export function insertAfter(e: React.DragEvent, horizontal: boolean) {
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  return horizontal ? e.clientX > r.left + r.width / 2 : e.clientY > r.top + r.height / 2;
}
