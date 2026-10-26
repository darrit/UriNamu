import { useId, useRef } from "react";
import { CalendarDays } from "lucide-react";
import { dateLabel, dateValue } from "./dates";
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
  example: string;
  onChange: (value: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const calendar = useRef<HTMLInputElement>(null);
  return (
    <div className="date-field">
      <label className="field-caption" htmlFor={id}>
        {label}
        {required && <span className="required-mark">{t("required")}</span>}
      </label>
      <div className="date-field-controls">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={t("forExample", { example })}
          pattern="\d{2}\.\d{2}\.\d{4}"
          value={dateLabel(value)}
          required={required}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={(e) => onChange(dateValue(e.target.value))}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={t("openCalendar", { label })}
          onClick={() => calendar.current?.showPicker()}
        >
          <CalendarDays size={18} />
        </button>
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
      </div>
    </div>
  );
}
