import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type FieldLabelProps = {
  label: string;
  htmlFor: string;
  hint?: string;
};

export function FieldLabel({ label, htmlFor, hint }: FieldLabelProps) {
  return (
    <div className="mb-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]"
      >
        {label}
      </label>
      {hint ? (
        <p className="mt-0.5 text-xs text-[#6B6B6B]">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  "w-full rounded-[6px] border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#0A0A0A] placeholder:text-[#6B6B6B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[#0A0A0A]";

type FieldInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export function FieldInput({ label, hint, id, className = "", ...props }: FieldInputProps) {
  const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={className}>
      <FieldLabel label={label} htmlFor={fieldId} hint={hint} />
      <input id={fieldId} className={inputClass} {...props} />
    </div>
  );
}

type FieldTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export function FieldTextarea({
  label,
  hint,
  id,
  className = "",
  ...props
}: FieldTextareaProps) {
  const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={className}>
      <FieldLabel label={label} htmlFor={fieldId} hint={hint} />
      <textarea id={fieldId} className={`${inputClass} min-h-[100px] resize-y`} {...props} />
    </div>
  );
}

type FieldSelectProps = {
  label: string;
  htmlFor: string;
  children: ReactNode;
  className?: string;
};

export function FieldSelect({ label, htmlFor, children, className = "" }: FieldSelectProps) {
  return (
    <div className={className}>
      <FieldLabel label={label} htmlFor={htmlFor} />
      <select id={htmlFor} className={inputClass}>
        {children}
      </select>
    </div>
  );
}
