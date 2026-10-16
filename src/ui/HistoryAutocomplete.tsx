import { Autocomplete, Input } from '@cloudflare/kumo';
import { useEffect, useState, type ReactNode } from 'react';
import { hasHistory, suggest, type Suggestion } from '@/src/lib/suggest';
import { BookmarkIcon, hostOf } from './icons';

/**
 * 带浏览记录补全的输入框（名称或 URL 都可以用）。
 * 输入时按关键词搜历史记录，选中一条会同时回填 URL 和名称（onPick）。
 */
export function HistoryAutocomplete({
  label, value, onChange, onPick, enabled, placeholder, description,
}: {
  label: ReactNode; value: string; onChange: (v: string) => void; onPick: (s: Suggestion) => void;
  enabled: boolean; placeholder?: string; description?: ReactNode;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [typed, setTyped] = useState(false); // 只在用户输入后才弹出，避免打开对话框就弹
  useEffect(() => {
    if (!enabled || !typed) { setItems([]); return; }
    let live = true;
    const t = setTimeout(() => void suggest(value).then((r) => live && setItems(r)), 150);
    return () => { live = false; clearTimeout(t); };
  }, [value, enabled, typed]);

  // 未开启补全时用普通输入框，避免 Autocomplete 的焦点管理影响对话框里其他输入框
  if (!enabled) return <Input label={label} description={description} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />;

  return (
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
      <Autocomplete.InputGroup placeholder={placeholder} className="w-full" />
      {items.length > 0 && (
        <Autocomplete.Content>
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
  );
}

/** 浏览记录补全是否可用（开关在 设置 → 通用；授权状态就是开关状态） */
export function useHistoryPermission() {
  const [granted, setGranted] = useState(false);
  useEffect(() => { void hasHistory().then(setGranted); }, []);
  return { granted };
}
