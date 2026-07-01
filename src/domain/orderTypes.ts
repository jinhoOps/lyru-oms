export const ORDER_SOURCES = [
  '카카오톡 채널',
  '인스타그램',
  '네이버 톡톡',
  '네이버 스마트스토어',
  '네이버예약',
  '기타',
] as const;

export const ORDER_STATUSES = ['수집', '확인필요', '정리 완료'] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type WarningLevel = 'none' | 'attention';

export type FulfillmentType = '' | '픽업' | '택배';

export type PurposeCategory = '상견례/인사' | '답례품' | '기념일/행사' | '감사 선물' | '단체/기업' | '기타';
export type ReviewReasonGroup = 'info' | 'check';
export type ReviewReasonCode =
  | 'missing-field'
  | 'duplicate-raw-text'
  | 'event-purpose'
  | 'ambiguous-menu'
  | 'ambiguous-quantity'
  | 'bulk-real-unit'
  | 'minimum-order'
  | 'delivery-check'
  | 'relative-date';

export interface MenuMatch {
  menuId: string;
  label: string;
  unitCount: number | null;
  confidence: 'exact' | 'alias' | 'family';
}

export interface QuantityCandidate {
  value: number;
  unit: '개' | '세트';
  rawText: string;
}

export interface ParsedDateValue {
  isoDate: string;
  timeText: string;
  originalText: string;
  isRelative: boolean;
}

export interface MinimumOrderRule {
  unitCount: number;
  minimumSets: number;
}

export interface QuantityRules {
  bulkRealUnitThreshold: number;
  minimumOrderRules: MinimumOrderRule[];
}

export type OrderFieldKey =
  | 'customerName'
  | 'phone'
  | 'orderItems'
  | 'quantity'
  | 'purpose'
  | 'fulfillmentType'
  | 'desiredDateTime'
  | 'pickupTime'
  | 'address'
  | 'allergyNote'
  | 'options'
  | 'customerRequestNote'
  | 'ownerMemo';

export type ReviewReasonKind = '정보 부족' | '확인필요' | '중복 가능성';

export interface ReviewReason {
  kind: ReviewReasonKind;
  group: ReviewReasonGroup;
  code: ReviewReasonCode;
  field?: OrderFieldKey;
  label: string;
  detail?: string;
  message: string;
}

export interface ConditionalRequiredField {
  field: 'fulfillmentType';
  equals: Exclude<FulfillmentType, ''>;
}

export interface OrderSettings {
  requiredFields: readonly OrderFieldKey[];
  conditionalRequiredFields: Partial<Record<OrderFieldKey, ConditionalRequiredField>>;
  quantityRules: QuantityRules;
}

export interface ReparseDifference {
  field: OrderFieldKey;
  extractedValue: string;
}

export interface CapturedOrder {
  id: string;
  source: OrderSource;
  rawText: string;
  customerName: string;
  phone: string;
  orderItems: string;
  quantity: string;
  purpose: string;
  fulfillmentType: FulfillmentType;
  desiredDateTime: string;
  pickupTime: string;
  address: string;
  allergyNote: string;
  options: string;
  customerRequestNote: string;
  ownerMemo: string;
  menuMatches: MenuMatch[];
  quantityCandidates: QuantityCandidate[];
  parsedDate: ParsedDateValue | null;
  manuallyEditedFields: OrderFieldKey[];
  reparseDifferences: ReparseDifference[];
  missingFields: OrderFieldKey[];
  reviewReasons: ReviewReason[];
  warningLevel: WarningLevel;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export const FIELD_DEFINITIONS = {
  customerName: { label: '고객명', keywords: ['성함', '이름', '고객명'] },
  phone: { label: '연락처', keywords: ['연락처', '전화번호', '휴대폰'] },
  orderItems: { label: '주문 내용', keywords: ['주문 내용', '주문상품', '상품'] },
  quantity: { label: '수량', keywords: ['수량', '개수', '주문 수량'] },
  purpose: { label: '선물 용도', keywords: ['선물 용도', '용도'] },
  fulfillmentType: { label: '수령 방식', keywords: ['픽업/택배', '수령 방식', '수령방법'] },
  desiredDateTime: { label: '희망일', keywords: ['픽업 날짜 및 시간', '희망일', '희망 날짜', '배송 날짜'] },
  pickupTime: { label: '픽업 시간', keywords: ['픽업 시간', '방문 시간'] },
  address: { label: '택배 주소', keywords: ['택배 주소', '주소', '배송지'] },
  allergyNote: { label: '알레르기', keywords: ['견과류 알레르기 유무', '알레르기'] },
  options: { label: '추가 옵션', keywords: ['추가 옵션', '보자기/노리개/꽃'] },
  customerRequestNote: { label: '고객 요청사항', keywords: ['요청사항', '기타 요청사항', '메모'] },
  ownerMemo: { label: '사장님 내부 메모', keywords: [] },
} as const satisfies Record<OrderFieldKey, { label: string; keywords: readonly string[] }>;

export const DEFAULT_SETTINGS = {
  requiredFields: ['orderItems', 'quantity', 'desiredDateTime', 'fulfillmentType'],
  conditionalRequiredFields: {
    address: { field: 'fulfillmentType', equals: '택배' },
  },
  quantityRules: {
    bulkRealUnitThreshold: 40,
    minimumOrderRules: [
      { unitCount: 2, minimumSets: 5 },
      { unitCount: 4, minimumSets: 2 },
    ],
  },
} as const satisfies OrderSettings;

export const EMPTY_ORDER_FIELDS = {
  customerName: '',
  phone: '',
  orderItems: '',
  quantity: '',
  purpose: '',
  fulfillmentType: '' as FulfillmentType,
  desiredDateTime: '',
  pickupTime: '',
  address: '',
  allergyNote: '',
  options: '',
  customerRequestNote: '',
  ownerMemo: '',
} as const satisfies Record<OrderFieldKey, string>;
