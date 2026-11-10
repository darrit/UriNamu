import { useId, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { dateLabel, datePattern, dateValue } from "./dates";
import { t } from "./i18n";

export default function DateField({
  label,
  value,
  example,
  onChange,
  required,
  autoFocus,
  disabled,
}: {
  label: string;
  value: string;
  /** Example date as ISO (YYYY-MM-DD); shown in the active language's format. */
  example: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const calendar = useRef<HTMLInputElement>(null);
  const [precision, setPrecision] = useState<"full" | "year" | "unknown">(/^\d{4}$/.test(value) ? "year" : value || required ? "full" : "unknown");
  return (
    <div className="date-field">
      <label className="field-caption" htmlFor={precision === "unknown" ? `${id}-precision` : id}>
        {label}
        {required && <span className="required-mark">{t("required")}</span>}
      </label>
      <select id={`${id}-precision`} aria-label={`${label}: ${t("datePrecision")}`} value={precision} disabled={disabled}
        onChange={event => {
          const mode = event.target.value as typeof precision;
          setPrecision(mode);
          onChange(mode === "unknown" ? "" : mode === "year" ? (/^\d{4}(?:-|$)/.test(value) ? value.slice(0, 4) : "") : (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""));
        }}>
        <option value="full">{t("dateFull")}</option>
        <option value="year">{t("dateYearOnly")}</option>
        {!required && <option value="unknown">{t("dateUnknown")}</option>}
      </select>
      {precision !== "unknown" &&
      <div className="date-field-controls">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={t("forExample", { example: precision === "year" ? "1987" : dateLabel(example) })}
          pattern={precision === "year" ? "[0-9]{4}" : datePattern()}
          value={dateLabel(value)}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => onChange(dateValue(e.target.value))}
        />
        {precision === "full" && <button
          type="button"
          disabled={disabled}
          aria-label={t("openCalendar", { label })}
          onClick={() => calendar.current?.showPicker()}
        >
          <CalendarDays size={18} />
        </button>}
        <input
          ref={calendar}
          className="date-field-native"
          type="date"
          tabIndex={-1}
          aria-label={t("pickCalendar", { label })}
          disabled={disabled}
          value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>}
    </div>
  );
}
