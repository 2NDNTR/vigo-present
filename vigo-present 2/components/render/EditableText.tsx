'use client';

import React, { useEffect, useRef } from 'react';

interface Props {
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: () => void;
}

/**
 * Click the text. Type. Done.
 * Uncontrolled on purpose so the caret never jumps while typing.
 */
export default function EditableText({
  value,
  onChange,
  editable,
  placeholder,
  className,
  style,
  onFocus,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && el.innerText !== (value || '')) {
      el.innerText = value || '';
    }
  }, [value]);

  if (!editable) {
    return (
      <div className={className} style={style}>
        {value || placeholder || ''}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={(className || '') + ' editable-text'}
      style={style}
      data-ph={placeholder || ''}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      onFocus={onFocus}
      onInput={(e) => onChange && onChange((e.target as HTMLElement).innerText)}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        e.stopPropagation();
      }}
    />
  );
}
