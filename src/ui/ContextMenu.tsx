import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, type LucideIcon } from 'lucide-react';

export interface MenuItem {
  label?: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  /** 单选项：当前选中时右侧显示对勾 */
  checked?: boolean;
  onSelect?: () => void;
}

type Open = (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => void;
const Ctx = createContext<Open>(() => {});
export const useContextMenu = () => useContext(Ctx);

/** 右键菜单：在鼠标处打开，靠近屏幕边缘时自动向上 / 向左展开 */
export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const open = useCallback<Open>((e, items) => {
    e.preventDefault?.();
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);

  useLayoutEffect(() => {
    if (!state || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const left = state.x + r.width > window.innerWidth - 8 ? Math.max(8, state.x - r.width) : state.x;
    const top = state.y + r.height > window.innerHeight - 8 ? Math.max(8, state.y - r.height) : state.y;
    setPos({ left, top });
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const close = () => setState(null);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
    };
  }, [state]);

  return (
    <Ctx.Provider value={open}>
      {children}
      {state && (
        <div
          ref={ref}
          role="menu"
          className="fixed z-[1000] min-w-44 rounded-lg border border-kumo-line bg-kumo-elevated p-1 shadow-lg"
          style={pos}
          onMouseDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {state.items.map((it, i) =>
            it.divider ? (
              <div key={i} className="my-1 h-px bg-kumo-line" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-kumo-tint disabled:opacity-40 ${
                  it.danger ? 'text-kumo-danger' : 'text-kumo-default'
                }`}
                onClick={() => {
                  setState(null);
                  it.onSelect?.();
                }}
              >
                {it.icon && <it.icon size={16} />}
                <span className="flex-1">{it.label}</span>
                {it.checked && <Check size={14} />}
              </button>
            ),
          )}
        </div>
      )}
    </Ctx.Provider>
  );
}
