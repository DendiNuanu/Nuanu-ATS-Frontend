"use client";

import { useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type CreatableSelectOption = {
  value: string;
  label: string;
};

/**
 * A searchable, creatable single-select combobox.
 *
 * Lets the user either pick an existing option from a filterable list or type
 * a new value and add it as a new option (via `onCreate`). Mirrors the visual
 * language of the app's standard inputs (h-11, rounded-lg, slate borders,
 * teal focus ring) so it can drop in wherever a `<select>` was used.
 *
 * Keyboard support:
 *  - Type to filter the option list (case-insensitive substring match).
 *  - ArrowUp/ArrowDown move the highlighted option.
 *  - Enter picks the highlighted option, or creates the typed value when
 *    nothing matches and creation is enabled.
 *  - Escape closes the dropdown without changing the selection.
 *  - Backspace on the (read-only) input is ignored so the current selection
 *    can't be accidentally cleared while navigating.
 */
export function CreatableSelect({
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Select…",
  emptyOptionLabel,
  disabled = false,
  className,
  id,
}: {
  /** Existing options to pick from. */
  options: CreatableSelectOption[];
  /** Currently selected option value ("" = nothing selected). */
  value: string;
  /** Called when an existing option is picked (or cleared). */
  onChange: (value: string) => void;
  /**
   * Called with the trimmed typed value when the user adds a NEW entry.
   * The parent is responsible for persisting it (e.g. POST to an API) and
   * then calling onChange with the new option's value.
   */
  onCreate?: (label: string) => void | Promise<void>;
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Label for the explicit "no value" option (e.g. "No department"). */
  emptyOptionLabel?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const reactId = useId();
  const listboxId = id ?? `creatable-select-${reactId}`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? "";

  // Filtered option list (case-insensitive substring match on the label).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Whether the typed query would be a NEW value (not matching any existing
  // option label, case-insensitive exact match).
  const isNewValue =
    query.trim() !== "" &&
    !options.some(
      (option) => option.label.toLowerCase() === query.trim().toLowerCase(),
    );

  // Rows rendered in the dropdown: optional explicit empty option first, then
  // matching options, then the "create" row when the query is a new value.
  const rows = useMemo(() => {
    const list: Array<
      | { type: "empty"; label: string }
      | { type: "option"; option: CreatableSelectOption }
      | { type: "create"; label: string }
    > = [];
    if (emptyOptionLabel) {
      list.push({ type: "empty", label: emptyOptionLabel });
    }
    for (const option of filtered) {
      list.push({ type: "option", option });
    }
    if (isNewValue && onCreate) {
      list.push({ type: "create", label: query.trim() });
    }
    return list;
  }, [emptyOptionLabel, filtered, isNewValue, onCreate, query]);

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setHighlightedIndex(0);
  };

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
    setHighlightedIndex(0);
  };

  const selectOption = (optionValue: string) => {
    onChange(optionValue);
    closeDropdown();
    inputRef.current?.blur();
  };

  const handleCreate = async () => {
    if (!onCreate || creating) return;
    const label = query.trim();
    if (!label) return;
    setCreating(true);
    try {
      await onCreate(label);
    } finally {
      setCreating(false);
      closeDropdown();
      inputRef.current?.blur();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (
        event.key === "ArrowDown" ||
        event.key === "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, rows.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        event.preventDefault();
        if (rows.length === 0) return;
        {
          const row = rows[Math.min(highlightedIndex, rows.length - 1)];
          if (row.type === "empty") {
            selectOption("");
          } else if (row.type === "option") {
            selectOption(row.option.value);
          } else {
            void handleCreate();
          }
        }
        break;
      case "Escape":
        event.preventDefault();
        closeDropdown();
        inputRef.current?.blur();
        break;
      case "Tab":
        closeDropdown();
        break;
      case "Backspace":
        // Read-only input: prevent accidental clearing of the selection.
        event.preventDefault();
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      data-open={open ? "true" : "false"}
    >
      <input
        ref={inputRef}
        id={listboxId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${listboxId}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        readOnly={!open}
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onFocus={openDropdown}
        onClick={openDropdown}
        onBlur={(event) => {
          // Close when focus leaves the whole combobox. Dropdown rows use
          // onMouseDown(preventDefault) + onClick so focus stays on the
          // input; if relatedTarget is outside this container, the user
          // clicked/tabbed elsewhere — close without changing the selection.
          const next = event.relatedTarget as Node | null;
          if (!next || !containerRef.current?.contains(next)) {
            closeDropdown();
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "h-11 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#006b5f] focus:ring-2 focus:ring-[#006b5f]/20",
          disabled && "cursor-not-allowed bg-slate-50 text-slate-400",
        )}
      />
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-transform",
          open && "rotate-180",
        )}
      />
      {open && (
        <ul
          id={`${listboxId}-listbox`}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {rows.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-400">
              No matching options
            </li>
          )}
          {rows.map((row, index) => {
            const isHighlighted = index === highlightedIndex;
            if (row.type === "empty") {
              return (
                <li
                  key="empty"
                  role="option"
                  aria-selected={value === ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption("")}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    isHighlighted ? "bg-slate-100 text-slate-900" : "text-slate-500",
                  )}
                >
                  {row.label}
                </li>
              );
            }
            if (row.type === "option") {
              const isSelected = row.option.value === value;
              return (
                <li
                  key={row.option.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectOption(row.option.value)}
                  className={cn(
                    "cursor-pointer px-3 py-2 text-sm",
                    isHighlighted
                      ? "bg-slate-100 text-slate-900"
                      : isSelected
                        ? "bg-[#e6f5f3] text-[#006b5f]"
                        : "text-slate-700",
                  )}
                >
                  {row.option.label}
                </li>
              );
            }
            return (
              <li
                key="create"
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => void handleCreate()}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm font-medium text-[#006b5f]",
                  isHighlighted && "bg-[#e6f5f3]",
                  creating && "opacity-60",
                )}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {creating ? "Adding…" : `Add "${row.label}"`}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
