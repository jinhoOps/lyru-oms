import { useState } from 'react';

interface ReparseHintProps {
  extractedValue: string;
}

export function ReparseHint({ extractedValue }: ReparseHintProps) {
  const [open, setOpen] = useState(false);
  const message = `원문에서는 이렇게 가져왔어요: ${extractedValue}`;

  return (
    <span
      className="reparseHint"
      tabIndex={0}
      aria-label={message}
      title={message}
      onBlur={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span aria-hidden="true" className="reparseDot" />
      {open ? <span className="reparseTooltip">{message}</span> : null}
    </span>
  );
}
