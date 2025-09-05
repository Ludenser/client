import React, { useEffect, useRef, useState } from "react";

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Выбрать…",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const btnRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (!btnRef.current || !listRef.current) return;
      if (
        !btnRef.current.contains(e.target) &&
        !listRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selectedLabel =
    options.find((o) => o.value === value)?.label || placeholder;

  const selectIndex = (idx) => {
    const opt = options[idx];
    if (!opt) return;
    onChange?.(opt.value);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className="w-full text-left border border-white/20 bg-black/20 text-gray-100 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={!value ? "text-gray-400" : ""}>{selectedLabel}</span>
        <svg
          className="ml-2 h-4 w-4 text-gray-300"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-white/15 bg-black/95 backdrop-blur-md shadow-2xl"
          role="listbox"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(options.length - 1, h + 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(0, h - 1));
            }
            if (e.key === "Enter") {
              e.preventDefault();
              selectIndex(highlight);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        >
          {options.length === 0 && (
            <li className="px-3 py-2 text-gray-400">Нет элементов</li>
          )}
          {options.map((opt, idx) => {
            const isActive = opt.value === value;
            const isHigh = idx === highlight;
            return (
              <li
                key={String(opt.value)}
                className={`px-3 py-2 cursor-pointer select-none ${
                  isHigh ? "bg-white/10" : ""
                } ${isActive ? "text-indigo-300" : "text-gray-100"}`}
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange?.(opt.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={isActive}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
