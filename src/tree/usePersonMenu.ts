import { useEffect, useRef, useState } from "react";

export function usePersonMenu() {
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
    null,
  );
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus();
    const outside = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(null);
        document
          .querySelector<HTMLButtonElement>(
            `[data-person="${CSS.escape(menu.id)}"]`,
          )
          ?.focus();
      }
      if (e.key === "Tab") setMenu(null);
      if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        const buttons = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)",
          ) || [],
        );
        const index = buttons.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        buttons[
          (index + (e.key === "ArrowDown" ? 1 : buttons.length - 1)) %
            buttons.length
        ]?.focus();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("wheel", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("wheel", close, true);
    };
  }, [menu]);
  return { menu, setMenu, menuRef };
}
