import { Button, Dialog } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function Modal({
  open, onClose, title, children, footer, size = 'base', form = false,
}: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'base' | 'lg' | 'xl';
  /** 新建/编辑类表单：不显示右上角关闭按钮，点空白处不关闭，只能用底部按钮或 Esc */
  form?: boolean;
}) {
  return (
    <Dialog.Root open={open} disablePointerDismissal={form} onOpenChange={(o: boolean) => !o && onClose()}>
      <Dialog size={size} className="flex max-h-[85vh] flex-col p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          {!form && <Button variant="ghost" shape="square" size="sm" icon={<X />} aria-label="关闭" onClick={onClose} />}
        </div>
        {/* 负外边距 + 内边距：给输入框的 ring（box-shadow）留出空间，避免被 overflow 裁掉 */}
        <div className="navill-modal-body -m-1 min-h-0 flex-1 overflow-y-auto p-1">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </Dialog>
    </Dialog.Root>
  );
}
