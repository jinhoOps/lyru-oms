import { describe, expect, it, vi } from 'vitest';
import { createNasdaqSampleOrder } from './devSeedOrders';
import {
  createOrderRepository,
  mapOrderFromRow,
  mapOrderToRow,
  type OrderRow,
  type WorkspaceSettingsRow,
} from './orderRepository';
import type { CapturedOrder, OrderSettings } from './orderTypes';

const workspaceId = '00000000-0000-4000-8000-000000000201';

const settings: OrderSettings = {
  requiredFields: ['orderItems', 'quantity'],
  conditionalRequiredFields: {},
  quantityRules: {
    bulkRealUnitThreshold: 24,
    minimumOrderRules: [{ unitCount: 4, minimumSets: 3 }],
  },
};

const toOrderRow = (order: CapturedOrder): OrderRow => mapOrderToRow(order, workspaceId);

function createSupabaseMock({
  orderRows = [],
  settingsRow = null,
  changeRequestRows = [],
  savedOrderRow,
  insertedChangeRequestRow = null,
  savedSettingsRow,
}: {
  orderRows?: OrderRow[];
  settingsRow?: WorkspaceSettingsRow | null;
  changeRequestRows?: Array<{ id: string; order_id: string; note: string; confirmed: boolean; updated_at: string }>;
  savedOrderRow?: OrderRow;
  insertedChangeRequestRow?: { id: string; note: string; confirmed: boolean } | null;
  savedSettingsRow?: WorkspaceSettingsRow;
} = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const record = (table: string, method: string, args: unknown[]) => {
    calls.push({ table, method, args });
  };

  const createSelectQuery = (table: string) => {
    const query = {
      eq: vi.fn((column: string, value: unknown) => {
        record(table, 'eq', [column, value]);
        return query;
      }),
      order: vi.fn((column: string, options?: unknown) => {
        record(table, 'order', [column, options]);
        return Promise.resolve({
          data: table === 'orders' ? orderRows : changeRequestRows,
          error: null,
        });
      }),
      maybeSingle: vi.fn(() => {
        record(table, 'maybeSingle', []);
        return Promise.resolve({ data: settingsRow, error: null });
      }),
    };

    return query;
  };

  const createMutationQuery = (table: string, payload: unknown) => {
    const query = {
      select: vi.fn((columns?: string) => {
        record(table, 'selectAfterMutation', [columns]);
        return query;
      }),
      single: vi.fn(() => {
        record(table, 'single', []);
        if (table === 'orders') {
          return Promise.resolve({ data: savedOrderRow ?? payload, error: null });
        }

        if (table === 'order_change_requests') {
          return Promise.resolve({ data: insertedChangeRequestRow, error: null });
        }

        return Promise.resolve({ data: savedSettingsRow ?? payload, error: null });
      }),
      eq: vi.fn((column: string, value: unknown) => {
        record(table, 'eq', [column, value]);
        return query;
      }),
    };

    return query;
  };

  const from = vi.fn((table: string) => ({
    select: vi.fn((columns?: string) => {
      record(table, 'select', [columns]);
      return createSelectQuery(table);
    }),
    upsert: vi.fn((payload: unknown) => {
      record(table, 'upsert', [payload]);
      return createMutationQuery(table, payload);
    }),
    insert: vi.fn((payload: unknown) => {
      record(table, 'insert', [payload]);
      return createMutationQuery(table, payload);
    }),
    delete: vi.fn(() => {
      record(table, 'delete', []);
      return createMutationQuery(table, {});
    }),
  }));

  return { from, calls };
}

describe('orderRepository', () => {
  it('maps Nasdaq sample order to Supabase order row', () => {
    const order = createNasdaqSampleOrder();

    expect(mapOrderToRow(order, workspaceId)).toMatchObject({
      id: '00000000-0000-4000-8000-000000000101',
      workspace_id: workspaceId,
      source: '네이버 스마트스토어',
      status: '신규',
      raw_text: order.rawText,
      customer_name: '나스닥3배',
      desired_date_time: '2026-07-05',
      warning_level: 'none',
    });
  });

  it('maps order row plus latest change request to CapturedOrder', () => {
    const row = toOrderRow(createNasdaqSampleOrder());

    expect(
      mapOrderFromRow(row, {
        id: 'change-request-1',
        note: '픽업 시간을 15:00로 변경 요청',
        confirmed: true,
      }),
    ).toMatchObject({
      id: row.id,
      customerName: '나스닥3배',
      changeRequestNote: '픽업 시간을 15:00로 변경 요청',
      changeRequestConfirmed: true,
    });
  });

  it('loads workspace orders, latest change requests, and settings from Supabase', async () => {
    const nasdaq = createNasdaqSampleOrder();
    const supabase = createSupabaseMock({
      orderRows: [toOrderRow(nasdaq)],
      settingsRow: { workspace_id: workspaceId, settings },
      changeRequestRows: [
        {
          id: 'newer-change',
          order_id: nasdaq.id,
          note: '최신 요청',
          confirmed: false,
          updated_at: '2026-07-04T00:00:00.000Z',
        },
        {
          id: 'older-change',
          order_id: nasdaq.id,
          note: '이전 요청',
          confirmed: true,
          updated_at: '2026-07-03T00:00:00.000Z',
        },
      ],
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.loadWorkspaceData(workspaceId)).resolves.toEqual({
      orders: [
        {
          ...nasdaq,
          changeRequestNote: '최신 요청',
          changeRequestConfirmed: false,
        },
      ],
      settings,
    });
    expect(supabase.from).toHaveBeenCalledWith('orders');
    expect(supabase.from).toHaveBeenCalledWith('workspace_settings');
    expect(supabase.from).toHaveBeenCalledWith('order_change_requests');
  });

  it('saves an order row and inserts a change request when note exists', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: false,
    };
    const orderRow = toOrderRow(order);
    const supabase = createSupabaseMock({
      savedOrderRow: orderRow,
      insertedChangeRequestRow: {
        id: 'inserted-change',
        note: '쇼핑백 2개로 변경',
        confirmed: false,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      id: order.id,
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: false,
    });
    expect(supabase.calls).toContainEqual({
      table: 'orders',
      method: 'upsert',
      args: [orderRow],
    });
    expect(supabase.calls).toContainEqual({
      table: 'order_change_requests',
      method: 'insert',
      args: [
        {
          workspace_id: workspaceId,
          order_id: order.id,
          note: '쇼핑백 2개로 변경',
          confirmed: false,
        },
      ],
    });
  });

  it('upserts workspace settings and returns saved settings', async () => {
    const supabase = createSupabaseMock({
      savedSettingsRow: { workspace_id: workspaceId, settings },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveSettings(workspaceId, settings)).resolves.toEqual(settings);
    expect(supabase.calls).toContainEqual({
      table: 'workspace_settings',
      method: 'upsert',
      args: [{ workspace_id: workspaceId, settings }],
    });
  });
});
