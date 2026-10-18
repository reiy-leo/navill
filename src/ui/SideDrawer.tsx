import { Button } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tr } from '@/src/i18n';

/** 右侧抽屉：桌面占半屏，窄屏全宽；点遮罩或 Esc 关闭 */
export function SideDrawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => { setShown(true); panel.current?.focus({ preventScroll: true }); }));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    // 只处理焦点在抽屉内（或页面空白处）的 Esc；抽屉里再弹出的对话框、菜单在别的 portal，由它们自己关闭
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target as Node | null;
      if (t && t !== document.body && !panel.current?.contains(t)) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 bg-kumo-overlay transition-opacity duration-200 ${shown ? 'opacity-80' : 'opacity-0'}`} onClick={onClose} />
      <aside
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-kumo-base shadow-2xl outline-none ring-1 ring-kumo-line transition-transform duration-200 ease-out md:w-1/2 ${shown ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between gap-4 px-6 pb-4 pt-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" shape="square" size="sm" icon={<X />} aria-label={tr('关闭')} onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
