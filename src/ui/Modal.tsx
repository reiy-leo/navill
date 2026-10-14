import { Button, Dialog } from '@cloudflare/kumo';
import { X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';

export function Modal({
  open, onClose, title, children, footer, size = 'base',
}: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'base' | 'lg' | 'xl' }) {
  return (
    <Dialog.Root open={open} onOpenChange={(o: boolean) => !o && onClose()}>
      <Dialog size={size} className="flex max-h-[85vh] flex-col p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
          <Button variant="ghost" shape="square" size="sm" icon={<X />} aria-label="关闭" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </Dialog>
    </Dialog.Root>
  );
}
