import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  FIELD_DEFINITIONS,
  type MinimumOrderRule,
  type OrderFieldKey,
  type OrderSettings,
} from '../domain/orderTypes';

interface SettingsModalProps {
  open: boolean;
  settings: OrderSettings;
  onClose: () => void;
  onSave: (settings: OrderSettings) => void | Promise<void>;
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

interface MinimumOrderRuleDraft {
  unitCount: string;
  minimumSets: string;
}

function toMinimumOrderRuleDrafts(rules: readonly MinimumOrderRule[]): MinimumOrderRuleDraft[] {
  return rules.map((rule) => ({
    unitCount: String(rule.unitCount),
    minimumSets: String(rule.minimumSets),
  }));
}

function parsePositiveInteger(value: string): number | null {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null;
}

export function SettingsModal({ open, settings, onClose, onSave }: SettingsModalProps) {
  const [requiredFields, setRequiredFields] = useState<OrderFieldKey[]>([...settings.requiredFields]);
  const [bulkQuantityThreshold, setBulkQuantityThreshold] = useState(
    String(settings.quantityRules.bulkRealUnitThreshold),
  );
  const [minimumOrderRules, setMinimumOrderRules] = useState<MinimumOrderRuleDraft[]>(
    toMinimumOrderRuleDrafts(settings.quantityRules.minimumOrderRules),
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setRequiredFields([...settings.requiredFields]);
    setBulkQuantityThreshold(String(settings.quantityRules.bulkRealUnitThreshold));
    setMinimumOrderRules(toMinimumOrderRuleDrafts(settings.quantityRules.minimumOrderRules));
    setIsSaving(false);
    setSaveError('');
    isSavingRef.current = false;
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

  function updateMinimumOrderRule(index: number, field: keyof MinimumOrderRuleDraft, value: string) {
    setMinimumOrderRules((currentRules) =>
      currentRules.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, [field]: value } : rule)),
    );
  }

  async function handleSave() {
    if (isSavingRef.current) {
      return;
    }

    const parsedThreshold = parsePositiveInteger(bulkQuantityThreshold);
    const nextMinimumOrderRules = settings.quantityRules.minimumOrderRules.map((previousRule, index) => {
      const draftRule = minimumOrderRules[index];

      if (!draftRule) {
        return previousRule;
      }

      return {
        unitCount: parsePositiveInteger(draftRule.unitCount) ?? previousRule.unitCount,
        minimumSets: parsePositiveInteger(draftRule.minimumSets) ?? previousRule.minimumSets,
      };
    });
    const nextSettings: OrderSettings = {
      requiredFields: [...requiredFields],
      conditionalRequiredFields: {
        address: { ...DEFAULT_SETTINGS.conditionalRequiredFields.address },
      },
      quantityRules: {
        ...settings.quantityRules,
        bulkRealUnitThreshold: parsedThreshold ?? settings.quantityRules.bulkRealUnitThreshold,
        minimumOrderRules: nextMinimumOrderRules,
      },
    };

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError('');

    try {
      await onSave(nextSettings);
      isSavingRef.current = false;
      setIsSaving(false);
      onClose();
    } catch {
      isSavingRef.current = false;
      setIsSaving(false);
      setSaveError('설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
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

        <fieldset className="settingsGroup">
          <legend>주문 수량 조건</legend>
          <label className="settingInput">
            대량 기준 실수량
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={bulkQuantityThreshold}
              onChange={(event) => setBulkQuantityThreshold(event.target.value)}
            />
          </label>
          <div className="quantityRuleList">
            {minimumOrderRules.map((rule, index) => (
              <div key={index} className="quantityRuleRow">
                <label>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    aria-label={`최소 주문 조건 ${index + 1} 상품 구수`}
                    value={rule.unitCount}
                    onChange={(event) => updateMinimumOrderRule(index, 'unitCount', event.target.value)}
                  />
                  <span>구 상품</span>
                </label>
                <label>
                  <span>최소</span>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    aria-label={`최소 주문 조건 ${index + 1} 최소 세트`}
                    value={rule.minimumSets}
                    onChange={(event) => updateMinimumOrderRule(index, 'minimumSets', event.target.value)}
                  />
                  <span>세트</span>
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        <p className="settingsNote">택배 주소는 수령 방식이 택배일 때만 추가 확인 항목으로 봅니다.</p>
        {saveError ? <p role="alert">{saveError}</p> : null}

        <div className="modalActions">
          <button type="button" className="secondaryButton" onClick={onClose}>
            취소
          </button>
          <button type="button" disabled={isSaving} onClick={handleSave}>
            {isSaving ? '저장 중' : '저장'}
          </button>
        </div>
      </section>
    </div>
  );
}
