import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  FIELD_DEFINITIONS,
  type OrderFieldKey,
  type OrderSettings,
} from '../domain/orderTypes';

interface SettingsModalProps {
  open: boolean;
  settings: OrderSettings;
  onClose: () => void;
  onSave: (settings: OrderSettings) => void;
}

const configurableRequiredFields: OrderFieldKey[] = [
  'customerName',
  'phone',
  'orderItems',
  'quantity',
  'desiredDateTime',
  'fulfillmentType',
  'purpose',
  'allergyNote',
  'options',
  'customerRequestNote',
];

export function SettingsModal({ open, settings, onClose, onSave }: SettingsModalProps) {
  const [requiredFields, setRequiredFields] = useState<OrderFieldKey[]>([...settings.requiredFields]);
  const [bulkQuantityThreshold, setBulkQuantityThreshold] = useState(String(settings.bulkQuantityThreshold));
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequiredFields([...settings.requiredFields]);
    setBulkQuantityThreshold(String(settings.bulkQuantityThreshold));
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open, settings]);

  if (!open) {
    return null;
  }

  function toggleRequiredField(field: OrderFieldKey) {
    setRequiredFields((current) =>
      current.includes(field) ? current.filter((item) => item !== field) : [...current, field],
    );
  }

  function handleSave() {
    const parsedThreshold = Number(bulkQuantityThreshold);
    const nextSettings: OrderSettings = {
      requiredFields: [...requiredFields],
      conditionalRequiredFields: {
        address: { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
        pickupTime: { ...DEFAULT_SETTINGS.conditionalRequiredFields.pickupTime },
      },
      bulkQuantityThreshold:
        Number.isFinite(parsedThreshold) && parsedThreshold > 0
          ? Math.floor(parsedThreshold)
          : settings.bulkQuantityThreshold,
    };

    onSave(nextSettings);
    onClose();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableControls = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

    if (focusableControls.length === 0) {
      return;
    }

    const firstControl = focusableControls[0];
    const lastControl = focusableControls[focusableControls.length - 1];

    if (event.shiftKey && document.activeElement === firstControl) {
      event.preventDefault();
      lastControl.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastControl) {
      event.preventDefault();
      firstControl.focus();
    }
  }

  return (
    <div className="modalBackdrop" role="presentation">
      <section
        ref={dialogRef}
        className="settingsModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={handleDialogKeyDown}
      >
        <div className="modalHeader">
          <div>
            <p className="eyebrow">관리 설정</p>
            <h2 id="settings-title">정보 부족 기준</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="iconButton" aria-label="설정 닫기" onClick={onClose}>
            ×
          </button>
        </div>

        <fieldset className="settingsGroup">
          <legend>필수 항목</legend>
          <div className="checkGrid">
            {configurableRequiredFields.map((field) => (
              <label key={field} className="checkRow">
                <input
                  type="checkbox"
                  checked={requiredFields.includes(field)}
                  onChange={() => toggleRequiredField(field)}
                />
                <span>{FIELD_DEFINITIONS[field].label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="settingInput">
          대량 주문 기준 수량
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={bulkQuantityThreshold}
            onChange={(event) => setBulkQuantityThreshold(event.target.value)}
          />
        </label>

        <p className="settingsNote">택배 주소는 택배 주문일 때, 픽업 시간은 픽업 주문일 때만 추가로 확인합니다.</p>

        <div className="modalActions">
          <button type="button" className="secondaryButton" onClick={onClose}>
            취소
          </button>
          <button type="button" onClick={handleSave}>
            저장
          </button>
        </div>
      </section>
    </div>
  );
}
