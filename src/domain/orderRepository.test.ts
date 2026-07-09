import { describe, expect, it, vi } from 'vitest';
import { createNasdaqSampleOrder } from './devSeedOrders';
import {
  createOrderRepository,
  mapOrderFromRow,
  mapOrderToRow,
  type OrderRow,
  type WorkspaceSettingsRow,
} from './orderRepository';
import { DEFAULT_SETTINGS, type CapturedOrder, type OrderSettings } from './orderTypes';

const workspaceId = '00000000-0000-4000-8000-000000000201';
type ChangeRequestRowMock = {
  id: string;
  order_id: string;
  note: string;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
};

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
  updatedChangeRequestRow = null,
  saveOrderRpcRow = null,
  rpcError = null,
  savedSettingsRow,
}: {
  orderRows?: OrderRow[];
  settingsRow?: WorkspaceSettingsRow | null;
  changeRequestRows?: ChangeRequestRowMock[];
  savedOrderRow?: OrderRow;
  insertedChangeRequestRow?: { id: string; note: string; confirmed: boolean; order_id?: string } | null;
  updatedChangeRequestRow?: { id: string; note: string; confirmed: boolean; order_id?: string } | null;
  saveOrderRpcRow?: (OrderRow & {
    change_request_id: string | null;
    change_request_note: string | null;
    change_request_confirmed: boolean | null;
  }) | null;
  rpcError?: Error | null;
  savedSettingsRow?: WorkspaceSettingsRow;
} = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const record = (table: string, method: string, args: unknown[]) => {
    calls.push({ table, method, args });
  };

  const createSelectQuery = (table: string) => {
    const resolveRows = () => ({
      data: table === 'orders' ? orderRows : changeRequestRows,
      error: null,
    });
    const query = {
      eq: vi.fn((column: string, value: unknown) => {
        record(table, 'eq', [column, value]);
        return query;
      }),
      order: vi.fn((column: string, options?: unknown) => {
        record(table, 'order', [column, options]);
        return query;
      }),
      limit: vi.fn((count: number) => {
        record(table, 'limit', [count]);
        const rows = table === 'order_change_requests' ? changeRequestRows.slice(0, count) : orderRows.slice(0, count);
        return Promise.resolve({ data: rows, error: null });
      }),
      maybeSingle: vi.fn(() => {
        record(table, 'maybeSingle', []);
        return Promise.resolve({ data: settingsRow, error: null });
      }),
      then: vi.fn((resolve, reject) => Promise.resolve(resolveRows()).then(resolve, reject)),
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
          return Promise.resolve({ data: updatedChangeRequestRow ?? insertedChangeRequestRow, error: null });
        }

        return Promise.resolve({ data: savedSettingsRow ?? payload, error: null });
      }),
      eq: vi.fn((column: string, value: unknown) => {
        record(table, 'eq', [column, value]);
        return query;
      }),
      in: vi.fn((column: string, values: unknown[]) => {
        record(table, 'in', [column, values]);
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
    upsert: vi.fn((payload: unknown, options?: unknown) => {
      record(table, 'upsert', options === undefined ? [payload] : [payload, options]);
      return createMutationQuery(table, payload);
    }),
    insert: vi.fn((payload: unknown) => {
      record(table, 'insert', [payload]);
      return createMutationQuery(table, payload);
    }),
    update: vi.fn((payload: unknown) => {
      record(table, 'update', [payload]);
      return createMutationQuery(table, payload);
    }),
    delete: vi.fn(() => {
      record(table, 'delete', []);
      return createMutationQuery(table, {});
    }),
  }));

  const rpc = vi.fn((functionName: string, args: unknown) => {
    record('rpc', functionName, [args]);
    return Promise.resolve({ data: saveOrderRpcRow ? [saveOrderRpcRow] : [], error: rpcError });
  });

  return { from, rpc, calls };
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

  it('round-trips a mapped order row back to CapturedOrder without a change request', () => {
    const order = createNasdaqSampleOrder();

    expect(mapOrderFromRow(mapOrderToRow(order, workspaceId))).toEqual(order);
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
          created_at: '2026-07-04T00:00:00.000Z',
          updated_at: '2026-07-04T00:00:00.000Z',
        },
        {
          id: 'older-change',
          order_id: nasdaq.id,
          note: '이전 요청',
          confirmed: true,
          created_at: '2026-07-03T00:00:00.000Z',
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
    expect(supabase.calls).toEqual(
      expect.arrayContaining([
        { table: 'order_change_requests', method: 'order', args: ['updated_at', { ascending: false }] },
        { table: 'order_change_requests', method: 'order', args: ['created_at', { ascending: false }] },
        { table: 'order_change_requests', method: 'order', args: ['id', { ascending: false }] },
      ]),
    );
  });

  it('falls back for malformed workspace settings fields instead of failing load', async () => {
    const supabase = createSupabaseMock({
      settingsRow: {
        workspace_id: workspaceId,
        settings: {
          requiredFields: ['quantity'],
        } as unknown as OrderSettings,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.loadWorkspaceData(workspaceId)).resolves.toEqual({
      orders: [],
      settings: {
        requiredFields: ['quantity'],
        conditionalRequiredFields: DEFAULT_SETTINGS.conditionalRequiredFields,
        quantityRules: DEFAULT_SETTINGS.quantityRules,
      },
    });
  });

  it('saves an order and change request through the transactional RPC', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '  쇼핑백 2개로 변경  ',
      changeRequestConfirmed: false,
    };
    const orderRow = toOrderRow(order);
    const supabase = createSupabaseMock({
      saveOrderRpcRow: {
        ...orderRow,
        change_request_id: 'inserted-change',
        change_request_note: '쇼핑백 2개로 변경',
        change_request_confirmed: false,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      id: order.id,
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: false,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('save_order_with_details', {
      target_workspace_id: workspaceId,
      order_payload: orderRow,
      change_request_payload: {
        note: '쇼핑백 2개로 변경',
        confirmed: false,
      },
    });
    expect(supabase.calls.some((call) => call.table === 'orders' && call.method === 'upsert')).toBe(false);
    expect(
      supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'upsert'),
    ).toBe(false);
  });

  it('maps the RPC change request response without selecting or updating child rows directly', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: true,
    };
    const supabase = createSupabaseMock({
      saveOrderRpcRow: {
        ...toOrderRow(order),
        change_request_id: 'latest-change',
        change_request_note: '쇼핑백 2개로 변경',
        change_request_confirmed: true,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      changeRequestNote: '쇼핑백 2개로 변경',
      changeRequestConfirmed: true,
    });
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'select')).toBe(false);
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'update')).toBe(false);
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'insert')).toBe(false);
  });

  it('sends a null change request payload when the note is empty', async () => {
    const order = {
      ...createNasdaqSampleOrder(),
      changeRequestNote: '   ',
      changeRequestConfirmed: false,
    };
    const supabase = createSupabaseMock({
      saveOrderRpcRow: {
        ...toOrderRow(order),
        change_request_id: null,
        change_request_note: null,
        change_request_confirmed: null,
      },
    });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).resolves.toMatchObject({
      changeRequestNote: '',
      changeRequestConfirmed: false,
    });
    expect(supabase.rpc).toHaveBeenCalledWith('save_order_with_details', {
      target_workspace_id: workspaceId,
      order_payload: toOrderRow(order),
      change_request_payload: null,
    });
    expect(supabase.calls.some((call) => call.table === 'order_change_requests' && call.method === 'delete')).toBe(false);
  });

  it('throws RPC errors when saving an order fails', async () => {
    const order = createNasdaqSampleOrder();
    const supabase = createSupabaseMock({ rpcError: new Error('rpc failed') });
    const repository = createOrderRepository(supabase as never);

    await expect(repository.saveOrder(workspaceId, order)).rejects.toThrow('rpc failed');
  });

  it('deletes only the requested order snapshot in the workspace', async () => {
    const supabase = createSupabaseMock();
    const repository = createOrderRepository(supabase as never);

    await expect(repository.deleteOrders(workspaceId, ['order-a', 'order-b'])).resolves.toBeUndefined();
    expect(supabase.calls).toContainEqual({ table: 'orders', method: 'delete', args: [] });
    expect(supabase.calls).toContainEqual({ table: 'orders', method: 'eq', args: ['workspace_id', workspaceId] });
    expect(supabase.calls).toContainEqual({ table: 'orders', method: 'in', args: ['id', ['order-a', 'order-b']] });
  });

  it('skips deleting orders when the requested snapshot is empty', async () => {
    const supabase = createSupabaseMock();
    const repository = createOrderRepository(supabase as never);

    await expect(repository.deleteOrders(workspaceId, [])).resolves.toBeUndefined();
    expect(supabase.from).not.toHaveBeenCalled();
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
