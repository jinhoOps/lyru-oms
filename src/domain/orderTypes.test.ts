import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  FIELD_DEFINITIONS,
  ORDER_SOURCES,
  ORDER_STATUSES,
} from './orderTypes';

describe('orderTypes defaults', () => {
  it('uses the confirmed operating statuses', () => {
    expect(ORDER_STATUSES).toEqual(['신규', '확인 필요', '제작 준비', '발송 완료']);
  });

  it('keeps Phase 1 default required fields and conditional fields', () => {
    expect(DEFAULT_SETTINGS.requiredFields).toEqual([
      'orderItems',
      'quantity',
      'desiredDateTime',
      'fulfillmentType',
    ]);
    expect(DEFAULT_SETTINGS.conditionalRequiredFields).toEqual({
      address: { field: 'fulfillmentType', equals: '택배' },
    });
    expect(DEFAULT_SETTINGS.quantityRules).toEqual({
      bulkRealUnitThreshold: 40,
      minimumOrderRules: [
        { unitCount: 2, minimumSets: 5 },
        { unitCount: 4, minimumSets: 2 },
      ],
    });
  });

  it('contains source and field labels shown to the owner', () => {
    expect(ORDER_SOURCES).toContain('카카오톡 채널');
    expect(FIELD_DEFINITIONS.customerRequestNote.label).toBe('고객 요청사항');
    expect(FIELD_DEFINITIONS.ownerMemo.label).toBe('사장님 내부 메모');
  });
});
