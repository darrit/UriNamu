import { useRef, type ReactNode } from "react";

/** Language-independent file chooser: the browser's own "Choose file" text follows the system language, so use our own button. */
export default function FilePick({
  accept,
  disabled,
  onFile,
  className,
  children,
  tabIndex,
}: {
  accept: string;
  disabled?: boolean;
  onFile: (file: File) => void;
  className?: string;
  children: ReactNode;
  tabIndex?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button type="button" className={className} disabled={disabled} tabIndex={tabIndex} onClick={() => input.current?.click()}>
        {children}
      </button>
    </>
  );
}
