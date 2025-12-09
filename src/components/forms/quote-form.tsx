'use client';

import { useState, useRef, useId } from 'react';
import { useMutation } from '@tanstack/react-query';
import { quoteSchema, type QuotePayload } from '@/lib/validation';

type QuoteFormProps = {
  services: { slug: string; title: string; method?: string }[];
};

type FieldErrors = Partial<Record<keyof QuotePayload, string[]>>;

export function QuoteForm({ services }: QuoteFormProps) {
  const formId = useId();
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    quantity: '50',
    service: services[0]?.method ?? 'SCREEN_PRINT',
    dueDate: '',
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const successMessageRef = useRef<HTMLDivElement>(null);
  const errorMessageRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: async (payload: QuotePayload) => {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Unable to submit quote');
      }

      return response.json();
    },
    onSuccess: () => {
      setFormState({
        name: '',
        email: '',
        company: '',
        phone: '',
        quantity: '50',
        service: services[0]?.method ?? 'SCREEN_PRINT',
        dueDate: '',
        notes: '',
      });
      setFieldErrors({});
      setFormError(null);

      // Focus success message for screen readers
      setTimeout(() => {
        successMessageRef.current?.focus();
      }, 100);
    },
    onError: (error: Error) => {
      setFormError(error.message);

      // Focus error message for screen readers
      setTimeout(() => {
        errorMessageRef.current?.focus();
      }, 100);
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const parsed = quoteSchema.safeParse({
      ...formState,
      quantity: Number(formState.quantity),
    });

    if (!parsed.success) {
      mutation.reset();
      const errors = parsed.error.flatten().fieldErrors as FieldErrors;
      setFieldErrors(errors);

      // Create user-friendly error message
      const errorMessages = Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`)
        .join('; ');
      setFormError(errorMessages || 'Please fix the errors below.');
      return;
    }

    mutation.mutate(parsed.data);
  };

  // Get minimum date for date picker (today)
  const today = new Date().toISOString().split('T')[0];

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      aria-label="Request a quote"
      aria-describedby={`${formId}-description`}
      noValidate
    >
      <p id={`${formId}-description`} className="sr-only">
        Fill out this form to request a custom print quote. Required fields are marked with an asterisk.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <Field
          id={`${formId}-name`}
          label="Full name"
          value={formState.name}
          onChange={(value) => setFormState((prev) => ({ ...prev, name: value }))}
          error={fieldErrors.name?.[0]}
          required
          autoComplete="name"
        />
        <Field
          id={`${formId}-company`}
          label="Company / Team"
          value={formState.company}
          onChange={(value) => setFormState((prev) => ({ ...prev, company: value }))}
          error={fieldErrors.company?.[0]}
          autoComplete="organization"
        />
        <Field
          id={`${formId}-email`}
          label="Email"
          type="email"
          value={formState.email}
          onChange={(value) => setFormState((prev) => ({ ...prev, email: value }))}
          error={fieldErrors.email?.[0]}
          required
          autoComplete="email"
        />
        <Field
          id={`${formId}-phone`}
          label="Phone"
          type="tel"
          value={formState.phone}
          onChange={(value) => setFormState((prev) => ({ ...prev, phone: value }))}
          error={fieldErrors.phone?.[0]}
          autoComplete="tel"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field
          id={`${formId}-quantity`}
          label="Quantity"
          type="number"
          value={formState.quantity}
          onChange={(value) => setFormState((prev) => ({ ...prev, quantity: value }))}
          error={fieldErrors.quantity?.[0]}
          required
          min="1"
        />

        <div className="space-y-1.5">
          <label
            htmlFor={`${formId}-service`}
            className="text-xs uppercase tracking-[0.3em] text-white/60"
          >
            Service lane <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <select
            id={`${formId}-service`}
            className="w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white transition-colors focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/20"
            value={formState.service}
            onChange={(event) =>
              setFormState((prev) => ({ ...prev, service: event.target.value }))
            }
            required
            aria-required="true"
            aria-invalid={!!fieldErrors.service}
            aria-describedby={fieldErrors.service ? `${formId}-service-error` : undefined}
          >
            {services.map((service) => (
              <option
                key={service.slug}
                value={service.method ?? 'SCREEN_PRINT'}
                className="bg-gray-900 text-white"
              >
                {service.title}
              </option>
            ))}
          </select>
          {fieldErrors.service && (
            <p
              id={`${formId}-service-error`}
              className="text-xs text-rose-300"
              role="alert"
            >
              {fieldErrors.service[0]}
            </p>
          )}
        </div>

        <Field
          id={`${formId}-dueDate`}
          label="In-hands date"
          type="date"
          value={formState.dueDate}
          onChange={(value) => setFormState((prev) => ({ ...prev, dueDate: value }))}
          error={fieldErrors.dueDate?.[0]}
          min={today}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${formId}-notes`}
          className="text-xs uppercase tracking-[0.3em] text-white/60"
        >
          Project notes
        </label>
        <textarea
          id={`${formId}-notes`}
          className="min-h-[120px] w-full rounded-2xl border border-white/20 bg-black/30 px-4 py-3 text-sm text-white transition-colors focus:border-white/60 focus:outline-none focus:ring-2 focus:ring-white/20"
          value={formState.notes}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, notes: event.target.value }))
          }
          placeholder="Budget, placements, tours, licensing requirements..."
          aria-describedby={`${formId}-notes-hint`}
        />
        <p id={`${formId}-notes-hint`} className="sr-only">
          Optional: Add any additional details about your project requirements
        </p>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-full bg-white px-6 py-4 text-base font-semibold text-gray-900 shadow-[0_15px_35px_rgba(107,114,255,0.35)] transition-opacity hover:opacity-90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-900"
        aria-busy={mutation.isPending}
        aria-disabled={mutation.isPending}
      >
        {mutation.isPending ? 'Sending...' : 'Request quote'}
      </button>

      {/* Status messages with ARIA live regions */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-h-[24px]"
      >
        {(mutation.isError || formError) && (
          <div
            ref={errorMessageRef}
            tabIndex={-1}
            className="rounded-lg border border-rose-500/20 bg-rose-900/20 p-3 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            role="alert"
          >
            <p className="text-sm text-rose-300">
              {mutation.error?.message || formError}
            </p>
          </div>
        )}

        {mutation.isSuccess && (
          <div
            ref={successMessageRef}
            tabIndex={-1}
            className="rounded-lg border border-emerald-500/20 bg-emerald-900/20 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <p className="text-sm text-emerald-300">
              Thanks! Our production team will reply within one business day.
            </p>
          </div>
        )}
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  error?: string;
  autoComplete?: string;
  min?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required,
  error,
  autoComplete,
  min,
}: FieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-[0.3em] text-white/60"
      >
        {label}{' '}
        {required && (
          <>
            <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        autoComplete={autoComplete}
        min={min}
        className={`w-full rounded-2xl border bg-black/30 px-4 py-3 text-sm text-white transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 ${
          error
            ? 'border-rose-500/50 focus:border-rose-500/80'
            : 'border-white/20 focus:border-white/60'
        }`}
      />
      {error && (
        <p id={errorId} className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
