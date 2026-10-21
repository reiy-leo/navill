import { Autocomplete, Button, Input } from '@cloudflare/kumo';
import { History, X } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { db } from '@/src/db';
import { tr } from '@/src/i18n';
import { seedFromHistory } from '@/src/lib/store';
import { hasHistory, requestHistory, suggest, type Suggestion } from '@/src/lib/suggest';
import { BookmarkIcon, hostOf } from './icons';

/**
 * 带浏览记录补全的输入框（名称或 URL 都可以用）。
 * 输入时按关键词搜历史记录，选中一条会同时回填 URL 和名称（onPick）。
 */
export function HistoryAutocomplete({
  label, value, onChange, onPick, enabled, placeholder, description, className, ariaLabel,
}: {
  label?: ReactNode; value: string; onChange: (v: string) => void; onPick: (s: Suggestion) => void;
  enabled: boolean; placeholder?: string; description?: ReactNode; className?: string; ariaLabel?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [typed, setTyped] = useState(false); // 只在用户输入后才弹出，避免打开对话框就弹
  useEffect(() => {
    if (!enabled || !typed) { setItems([]); return; }
    let live = true;
    const t = setTimeout(() => void suggest(value).then((r) => {
      if (!live) return;
      // 弹出列表最宽 = 所在弹窗宽度 × 1.1（列表在 portal 里，用根元素上的 CSS 变量传宽度）
      const dlg = box.current?.closest('[role="dialog"]') as HTMLElement | null;
      if (dlg) document.documentElement.style.setProperty('--nv-ac-max', `${Math.round(dlg.offsetWidth * 1.1)}px`);
      setItems(r);
    }), 150);
    return () => { live = false; clearTimeout(t); };
  }, [value, enabled, typed]);

  // 未开启补全时用普通输入框，避免 Autocomplete 的焦点管理影响对话框里其他输入框
  if (!enabled) return <Input label={label} description={description} placeholder={placeholder} aria-label={ariaLabel} className={className} value={value} onChange={(e) => onChange(e.target.value)} />;

  return (
    <div ref={box} className="contents">
    <Autocomplete
      label={label}
      description={description}
      items={items}
      filter={null}
      open={items.length > 0}
      onOpenChange={(o: boolean) => { if (!o) setItems([]); }}
      value={value}
      itemToStringValue={(s: unknown) => (s as Suggestion).url}
      onValueChange={(v: string, d: { reason?: string }) => {
        if (d?.reason === 'item-press' || d?.reason === 'none') return; // 选中由 onPick 处理
        setTyped(true);
        onChange(v);
      }}
    >
      <Autocomplete.InputGroup placeholder={placeholder} aria-label={ariaLabel} className={`w-full ${className ?? ''}`} />
      {items.length > 0 && (
        <Autocomplete.Content className="nv-ac-pop">
          <Autocomplete.List>
            {(s: Suggestion) => (
              <Autocomplete.Item key={s.url} value={s} onClick={() => { onPick(s); setItems([]); setTyped(false); }}>
                <span className="flex min-w-0 items-center gap-2">
                  <BookmarkIcon url={s.url} size={16} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{s.title || hostOf(s.url)}</span>
                    <span className="block truncate text-xs text-kumo-subtle">{s.url}</span>
                  </span>
                </span>
              </Autocomplete.Item>
            )}
          </Autocomplete.List>
        </Autocomplete.Content>
      )}
    </Autocomplete>
    </div>
  );
}

/* 授权状态在页面内共享：任一处开启后，提示条、补全、设置开关一起更新 */
let grantedNow: boolean | undefined;
const subs = new Set<() => void>();
const emit = (v: boolean) => { grantedNow = v; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => {
  subs.add(f);
  if (grantedNow === undefined) void hasHistory().then(emit);
  return () => { subs.delete(f); };
};
/** 设置里切换开关后调用，同步到其他地方 */
export const setHistoryGranted = emit;

/** 一键申请浏览记录权限；成功后补读本机访问次数 */
export async function enableHistory(): Promise<boolean> {
  const ok = await requestHistory();
  emit(ok);
  if (ok) await seedFromHistory(db, true).catch(() => 0);
  return ok;
}

/** 浏览记录补全是否可用（开关在 设置 → 通用；授权状态就是开关状态） */
export function useHistoryPermission() {
  const granted = useSyncExternalStore(subscribe, () => grantedNow ?? false);
  return { granted };
}

const HINT_OFF = 'nv-history-hint-off';
/** 未授权时的提示条：「开启」一键申请权限，× 不再提示 */
export function HistoryHint({ children, className }: { children: ReactNode; className?: string }) {
  const { granted } = useHistoryPermission();
  const [off, setOff] = useState(() => localStorage.getItem(HINT_OFF) === '1');
  if (granted || off || grantedNow === undefined) return null;
  return (
    <div className={`flex items-center gap-2 rounded-lg bg-kumo-tint px-3 py-1.5 text-sm text-kumo-subtle ${className ?? ''}`}>
      <History size={14} className="shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      <Button size="sm" variant="secondary" onClick={() => void enableHistory()}>{tr('开启')}</Button>
      <Button size="sm" variant="ghost" shape="square" icon={<X size={14} />} aria-label={tr('不再提示')} onClick={() => { localStorage.setItem(HINT_OFF, '1'); setOff(true); }} />
    </div>
  );
}
