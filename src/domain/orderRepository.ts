import {
  DEFAULT_SETTINGS,
  type CapturedOrder,
  type MenuMatch,
  type OrderFieldKey,
  type OrderSettings,
  type ParsedDateValue,
  type QuantityCandidate,
  type ReparseDifference,
  type ReviewReason,
} from './orderTypes';

export interface WorkspaceData {
  orders: CapturedOrder[];
  settings: OrderSettings;
}

export interface OrderRepository {
  loadWorkspaceData(workspaceId: string): Promise<WorkspaceData>;
  saveOrder(workspaceId: string, order: CapturedOrder): Promise<CapturedOrder>;
  deleteAllOrders(workspaceId: string): Promise<void>;
  saveSettings(workspaceId: string, settings: OrderSettings): Promise<OrderSettings>;
}

export interface OrderRow {
  id: string;
  workspace_id: string;
  source: CapturedOrder['source'];
  status: CapturedOrder['status'];
  raw_text: string;
  customer_name: string;
  phone: string;
  order_items: string;
  quantity: string;
  purpose: string;
  fulfillment_type: CapturedOrder['fulfillmentType'];
  desired_date_time: string;
  pickup_time: string;
  address: string;
  allergy_note: string;
  options: string;
  customer_request_note: string;
  owner_memo: string;
  parsed_date: ParsedDateValue | null;
  menu_matches: MenuMatch[];
  quantity_candidates: QuantityCandidate[];
  manually_edited_fields: OrderFieldKey[];
  reparse_differences: ReparseDifference[];
  missing_fields: OrderFieldKey[];
  review_reasons: ReviewReason[];
  warning_level: CapturedOrder['warningLevel'];
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettingsRow {
  workspace_id: string;
  settings: OrderSettings;
}

interface LatestChangeRequest {
  id: string;
  note: string;
  confirmed: boolean;
}

interface ChangeRequestRow extends LatestChangeRequest {
  order_id: string;
  created_at: string;
  updated_at: string;
}

type QueryResultValue<T> = { data: T; error: Error | null };
type QueryResult<T> = Promise<QueryResultValue<T>>;
type SelectQuery<T> = {
  eq(column: string, value: unknown): SelectQuery<T>;
  order(column: string, options?: unknown): SelectQuery<T>;
  limit(count: number): QueryResult<T>;
  maybeSingle(): QueryResult<T>;
  then<TResult1 = QueryResultValue<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResultValue<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};
type MutationQuery<T> = {
  select(columns?: string): MutationQuery<T>;
  single(): QueryResult<T>;
  eq(column: string, value: unknown): MutationQuery<T>;
  then<TResult1 = QueryResultValue<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResultValue<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};
type SupabaseLike = {
  from(table: string): {
    select<T>(columns?: string): SelectQuery<T>;
    upsert<T>(payload: unknown): MutationQuery<T>;
    insert<T>(payload: unknown): MutationQuery<T>;
    update<T>(payload: unknown): MutationQuery<T>;
    delete<T>(): MutationQuery<T>;
  };
};

const cloneSettings = (settings: OrderSettings): OrderSettings => ({
  requiredFields: [...settings.requiredFields],
  conditionalRequiredFields: Object.fromEntries(
    Object.entries(settings.conditionalRequiredFields).map(([field, rule]) => [field, rule ? { ...rule } : rule]),
  ),
  quantityRules: {
    bulkRealUnitThreshold: settings.quantityRules.bulkRealUnitThreshold,
    minimumOrderRules: settings.quantityRules.minimumOrderRules.map((rule) => ({ ...rule })),
  },
});

const cloneDefaultSettings = () => cloneSettings(DEFAULT_SETTINGS);

const throwIfError = (error: Error | null) => {
  if (error) {
    throw error;
  }
};

export const mapOrderToRow = (order: CapturedOrder, workspaceId: string): OrderRow => ({
  id: order.id,
  workspace_id: workspaceId,
  source: order.source,
  status: order.status,
  raw_text: order.rawText,
  customer_name: order.customerName,
  phone: order.phone,
  order_items: order.orderItems,
  quantity: order.quantity,
  purpose: order.purpose,
  fulfillment_type: order.fulfillmentType,
  desired_date_time: order.desiredDateTime,
  pickup_time: order.pickupTime,
  address: order.address,
  allergy_note: order.allergyNote,
  options: order.options,
  customer_request_note: order.customerRequestNote,
  owner_memo: order.ownerMemo,
  parsed_date: order.parsedDate,
  menu_matches: order.menuMatches,
  quantity_candidates: order.quantityCandidates,
  manually_edited_fields: order.manuallyEditedFields,
  reparse_differences: order.reparseDifferences,
  missing_fields: order.missingFields,
  review_reasons: order.reviewReasons,
  warning_level: order.warningLevel,
  created_at: order.createdAt,
  updated_at: order.updatedAt,
});

export const mapOrderFromRow = (row: OrderRow, latestChangeRequest?: LatestChangeRequest): CapturedOrder => ({
  id: row.id,
  source: row.source,
  rawText: row.raw_text,
  customerName: row.customer_name,
  phone: row.phone,
  orderItems: row.order_items,
  quantity: row.quantity,
  purpose: row.purpose,
  fulfillmentType: row.fulfillment_type,
  desiredDateTime: row.desired_date_time,
  pickupTime: row.pickup_time,
  address: row.address,
  allergyNote: row.allergy_note,
  options: row.options,
  customerRequestNote: row.customer_request_note,
  ownerMemo: row.owner_memo,
  changeRequestNote: latestChangeRequest?.note ?? '',
  changeRequestConfirmed: latestChangeRequest?.confirmed ?? false,
  menuMatches: row.menu_matches,
  quantityCandidates: row.quantity_candidates,
  parsedDate: row.parsed_date,
  manuallyEditedFields: row.manually_edited_fields,
  reparseDifferences: row.reparse_differences,
  missingFields: row.missing_fields,
  reviewReasons: row.review_reasons,
  warningLevel: row.warning_level,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const selectOrders = async (supabase: SupabaseLike, workspaceId: string): QueryResult<OrderRow[]> =>
  await supabase
    .from('orders')
    .select<OrderRow[]>('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });

const selectSettings = (supabase: SupabaseLike, workspaceId: string): QueryResult<WorkspaceSettingsRow | null> =>
  supabase
    .from('workspace_settings')
    .select<WorkspaceSettingsRow | null>('workspace_id, settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

const selectChangeRequests = async (supabase: SupabaseLike, workspaceId: string): QueryResult<ChangeRequestRow[]> =>
  await supabase
    .from('order_change_requests')
    .select<ChangeRequestRow[]>('id, order_id, note, confirmed, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });

const selectLatestChangeRequest = (
  supabase: SupabaseLike,
  workspaceId: string,
  orderId: string,
): QueryResult<ChangeRequestRow[]> =>
  supabase
    .from('order_change_requests')
    .select<ChangeRequestRow[]>('id, order_id, note, confirmed, created_at, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);

export function createOrderRepository(supabase: SupabaseLike): OrderRepository {
  return {
    async loadWorkspaceData(workspaceId) {
      const [ordersResult, settingsResult, changeRequestsResult] = await Promise.all([
        selectOrders(supabase, workspaceId),
        selectSettings(supabase, workspaceId),
        selectChangeRequests(supabase, workspaceId),
      ]);

      throwIfError(ordersResult.error);
      throwIfError(settingsResult.error);
      throwIfError(changeRequestsResult.error);

      const latestChangeRequestByOrderId = new Map<string, ChangeRequestRow>();
      for (const changeRequest of changeRequestsResult.data ?? []) {
        if (!latestChangeRequestByOrderId.has(changeRequest.order_id)) {
          latestChangeRequestByOrderId.set(changeRequest.order_id, changeRequest);
        }
      }

      return {
        orders: (ordersResult.data ?? []).map((row) => mapOrderFromRow(row, latestChangeRequestByOrderId.get(row.id))),
        settings: settingsResult.data?.settings ? cloneSettings(settingsResult.data.settings) : cloneDefaultSettings(),
      };
    },
    async saveOrder(workspaceId, order) {
      const orderResult = (await supabase
        .from('orders')
        .upsert<OrderRow>(mapOrderToRow(order, workspaceId))
        .select('*')
        .single()) as { data: OrderRow; error: Error | null };

      throwIfError(orderResult.error);

      const note = order.changeRequestNote.trim();
      if (!note) {
        const deleteResult = await supabase
          .from('order_change_requests')
          .delete<null>()
          .eq('workspace_id', workspaceId)
          .eq('order_id', order.id);

        throwIfError(deleteResult.error);
        return mapOrderFromRow(orderResult.data);
      }

      const latestChangeRequestResult = await selectLatestChangeRequest(supabase, workspaceId, order.id);
      throwIfError(latestChangeRequestResult.error);

      const latestChangeRequest = latestChangeRequestResult.data?.[0] ?? null;
      if (latestChangeRequest) {
        const changeRequestResult = await supabase
          .from('order_change_requests')
          .update<LatestChangeRequest>({
            note,
            confirmed: order.changeRequestConfirmed,
          })
          .eq('id', latestChangeRequest.id)
          .select('id, note, confirmed')
          .single();

        throwIfError(changeRequestResult.error);

        return mapOrderFromRow(orderResult.data, changeRequestResult.data);
      }

      const changeRequestResult = await supabase
        .from('order_change_requests')
        .insert<LatestChangeRequest>({
          workspace_id: workspaceId,
          order_id: order.id,
          note,
          confirmed: order.changeRequestConfirmed,
        })
        .select('id, note, confirmed')
        .single();

      throwIfError(changeRequestResult.error);

      return mapOrderFromRow(orderResult.data, changeRequestResult.data);
    },
    async deleteAllOrders(workspaceId) {
      const result = await supabase.from('orders').delete<null>().eq('workspace_id', workspaceId);

      throwIfError(result.error);
    },
    async saveSettings(workspaceId, settings) {
      const result = (await supabase
        .from('workspace_settings')
        .upsert<WorkspaceSettingsRow>({ workspace_id: workspaceId, settings })
        .select('workspace_id, settings')
        .single()) as { data: WorkspaceSettingsRow; error: Error | null };

      throwIfError(result.error);

      return cloneSettings(result.data.settings);
    },
  };
}
