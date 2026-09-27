import { Button } from './Button';
import { BrandMark } from './BrandMark';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
export function Modal({
  title,
  children,
  onClose,
  size = 'default',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  size?: 'default' | 'wide';
}) {
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    node?.showModal();
  }, [node]);
  return (
    <dialog
      ref={setNode}
      className={`service-dialog max-h-[90dvh] max-w-[calc(100vw-32px)] overflow-auto rounded-2xl
        bg-panel text-ink shadow-dialog backdrop:bg-black/50
        ${size === 'wide' ? 'guide-dialog w-240 p-0' : 'small-dialog w-120 p-7'}`}
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-top mb-6 flex items-center gap-3 ${size === 'wide' ? 'px-7 pt-6' : ''}`}
      >
        {size === 'wide' ? <h2 className="flex-1 text-heading">{title}</h2> : <BrandMark small />}
        <Button variant="icon" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      {size !== 'wide' && <h2 className="mb-3 text-heading">{title}</h2>}
      {children}
    </dialog>
  );
}
