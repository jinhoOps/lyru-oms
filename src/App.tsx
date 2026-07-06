import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createAuthRepository } from './auth/authRepository';
import type { WorkspaceMembership } from './auth/authTypes';
import { AuthGate } from './components/AuthGate';
import { OrderCaptureForm } from './components/OrderCaptureForm';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { QuestionNote } from './components/QuestionNote';
import { SettingsModal } from './components/SettingsModal';
import {
  DEFAULT_SETTINGS,
  ORDER_SOURCES,
  type CapturedOrder,
  type OrderSettings,
  type OrderSource,
} from './domain/orderTypes';
import { createOrderRepository, type OrderRepository } from './domain/orderRepository';
import { evaluateOrder } from './domain/reviewRules';
import { sortOrders, type OrderSortMode } from './domain/orderSorting';
import { createBrowserSupabaseClient } from './lib/supabaseClient';
import type { OrderSourceFilter } from './components/OrderList';

const CAPTURE_PANEL_COLLAPSED_KEY = 'lyru-oms.capturePanel.collapsed.v1';
const ORDER_DRAFT_KEY = 'lyru-oms.orderDraft.v1';

const loadCapturePanelCollapsed = () => {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }

    return localStorage.getItem(CAPTURE_PANEL_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

const saveCapturePanelCollapsed = (collapsed: boolean) => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(CAPTURE_PANEL_COLLAPSED_KEY, String(collapsed));
  } catch {
    // Ignore blocked storage; the in-memory state still updates.
  }
};

const createOrderDraftFields = (order: CapturedOrder) => ({
  customerName: order.customerName,
  phone: order.phone,
  orderItems: order.orderItems,
  quantity: order.quantity,
  purpose: order.purpose,
  fulfillmentType: order.fulfillmentType,
  desiredDateTime: order.desiredDateTime,
  pickupTime: order.pickupTime,
  address: order.address,
  allergyNote: order.allergyNote,
  options: order.options,
  customerRequestNote: order.customerRequestNote,
  ownerMemo: order.ownerMemo,
  changeRequestNote: order.changeRequestNote,
  changeRequestConfirmed: order.changeRequestConfirmed,
  status: order.status,
});

const saveOrderDraft = (order: CapturedOrder) => {
  try {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(
      ORDER_DRAFT_KEY,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        rawText: order.rawText,
        source: order.source,
        fields: createOrderDraftFields(order),
      }),
    );
  } catch {
    // Task 6 will add the full offline helper. This is only a minimal safety draft.
  }
};

type WorkspaceLoadStatus = 'loading' | 'ready' | 'error';

interface WorkspaceAppProps {
  membership: WorkspaceMembership;
  orderRepository: OrderRepository;
}

export function WorkspaceApp({ membership, orderRepository }: WorkspaceAppProps) {
  const [orders, setOrders] = useState<CapturedOrder[]>([]);
  const [settings, setSettings] = useState<OrderSettings>(() => DEFAULT_SETTINGS);
  const [loadStatus, setLoadStatus] = useState<WorkspaceLoadStatus>('loading');
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<OrderSortMode>('desiredDate');
  const [captureSource, setCaptureSource] = useState<OrderSource>('카카오톡 채널');
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('전체');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureCollapsed, setCaptureCollapsed] = useState(() => loadCapturePanelCollapsed());
  const currentWorkspaceIdRef = useRef(membership.workspaceId);
  const workspaceGenerationRef = useRef(0);
  const orderSaveSequenceByIdRef = useRef(new Map<string, number>());
  const settingsSaveSequenceRef = useRef(0);
  const workspaceMutationSequenceRef = useRef(0);
  const clearGenerationRef = useRef(0);

  if (currentWorkspaceIdRef.current !== membership.workspaceId) {
    currentWorkspaceIdRef.current = membership.workspaceId;
    workspaceGenerationRef.current += 1;
    orderSaveSequenceByIdRef.current.clear();
    settingsSaveSequenceRef.current = 0;
    workspaceMutationSequenceRef.current = 0;
    clearGenerationRef.current = 0;
  }

  const isCurrentWorkspaceGeneration = (workspaceId: string, generation: number) =>
    currentWorkspaceIdRef.current === workspaceId && workspaceGenerationRef.current === generation;

  const nextOrderSaveSequence = (orderId: string) => {
    const nextSequence = (orderSaveSequenceByIdRef.current.get(orderId) ?? 0) + 1;
    orderSaveSequenceByIdRef.current.set(orderId, nextSequence);

    return nextSequence;
  };

  const isLatestOrderSave = (workspaceId: string, generation: number, orderId: string, sequence: number) =>
    isCurrentWorkspaceGeneration(workspaceId, generation) &&
    orderSaveSequenceByIdRef.current.get(orderId) === sequence;

  const nextSettingsSaveSequence = () => {
    settingsSaveSequenceRef.current += 1;

    return settingsSaveSequenceRef.current;
  };

  const isLatestSettingsSave = (workspaceId: string, generation: number, sequence: number) =>
    isCurrentWorkspaceGeneration(workspaceId, generation) && settingsSaveSequenceRef.current === sequence;

  const nextWorkspaceMutationSequence = () => {
    workspaceMutationSequenceRef.current += 1;

    return workspaceMutationSequenceRef.current;
  };

  const isLatestWorkspaceMutation = (workspaceId: string, generation: number, sequence: number) =>
    isCurrentWorkspaceGeneration(workspaceId, generation) && workspaceMutationSequenceRef.current === sequence;

  const isOrderMutationCurrent = (workspaceId: string, generation: number, clearGeneration: number) =>
    isCurrentWorkspaceGeneration(workspaceId, generation) && clearGenerationRef.current === clearGeneration;

  useEffect(() => {
    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current + 1;
    workspaceGenerationRef.current = generation;
    currentWorkspaceIdRef.current = workspaceId;
    orderSaveSequenceByIdRef.current.clear();
    settingsSaveSequenceRef.current = 0;
    workspaceMutationSequenceRef.current = 0;
    clearGenerationRef.current = 0;

    setLoadStatus('loading');
    setSaveStatusMessage('');
    setSelectedId(null);
    setSourceFilter('전체');

    orderRepository
      .loadWorkspaceData(workspaceId)
      .then((workspaceData) => {
        if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
          return;
        }

        setOrders(workspaceData.orders);
        setSettings(workspaceData.settings);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
          return;
        }

        setLoadStatus('error');
      });

    return () => {
      if (isCurrentWorkspaceGeneration(workspaceId, generation)) {
        workspaceGenerationRef.current += 1;
      }
    };
  }, [membership.workspaceId, orderRepository]);

  const filteredOrders = useMemo(
    () => (sourceFilter === '전체' ? orders : orders.filter((order) => order.source === sourceFilter)),
    [orders, sourceFilter],
  );
  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedId) ?? null,
    [filteredOrders, selectedId],
  );
  const displayOrders = useMemo(() => sortOrders(filteredOrders, sortMode), [filteredOrders, sortMode]);

  async function handleSaveOrder(order: CapturedOrder) {
    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;
    const clearGeneration = clearGenerationRef.current;
    nextWorkspaceMutationSequence();

    try {
      const savedOrder = await orderRepository.saveOrder(workspaceId, order);

      if (!isOrderMutationCurrent(workspaceId, generation, clearGeneration)) {
        return false;
      }

      setOrders((current) => [savedOrder, ...current]);
      setSourceFilter(savedOrder.source);
      setSelectedId(savedOrder.id);
      setSaveStatusMessage('');
      return true;
    } catch {
      if (!isOrderMutationCurrent(workspaceId, generation, clearGeneration)) {
        return false;
      }

      saveOrderDraft(order);
      setSaveStatusMessage('저장하지 못했습니다. 입력 내용은 임시 저장했어요.');
      return false;
    }
  }

  async function handleClearOrders() {
    if (!window.confirm('저장된 주문을 모두 삭제할까요?')) {
      return;
    }

    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;
    clearGenerationRef.current += 1;
    const mutationSequence = nextWorkspaceMutationSequence();

    try {
      await orderRepository.deleteAllOrders(workspaceId);

      if (!isLatestWorkspaceMutation(workspaceId, generation, mutationSequence)) {
        return;
      }

      setOrders([]);
      setSelectedId(null);
      setSourceFilter('전체');
      setSaveStatusMessage('');
    } catch {
      if (!isLatestWorkspaceMutation(workspaceId, generation, mutationSequence)) {
        return;
      }

      setSaveStatusMessage('주문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  function handleSourceFilterChange(nextSourceFilter: OrderSourceFilter) {
    setSourceFilter(nextSourceFilter);
    setSelectedId((currentSelectedId) => {
      if (!currentSelectedId || nextSourceFilter === '전체') {
        return currentSelectedId;
      }

      const selected = orders.find((order) => order.id === currentSelectedId);
      return selected?.source === nextSourceFilter ? currentSelectedId : null;
    });
  }

  async function handleChangeOrder(nextOrder: CapturedOrder) {
    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;
    const clearGeneration = clearGenerationRef.current;
    const sequence = nextOrderSaveSequence(nextOrder.id);
    nextWorkspaceMutationSequence();

    setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));

    try {
      const savedOrder = await orderRepository.saveOrder(workspaceId, nextOrder);

      if (
        !isLatestOrderSave(workspaceId, generation, nextOrder.id, sequence) ||
        !isOrderMutationCurrent(workspaceId, generation, clearGeneration)
      ) {
        return;
      }

      setOrders((current) => current.map((order) => (order.id === savedOrder.id ? savedOrder : order)));
      setSaveStatusMessage('');
    } catch {
      if (
        !isLatestOrderSave(workspaceId, generation, nextOrder.id, sequence) ||
        !isOrderMutationCurrent(workspaceId, generation, clearGeneration)
      ) {
        return;
      }

      saveOrderDraft(nextOrder);
      setSaveStatusMessage('변경 내용을 저장하지 못했습니다. 임시 저장했어요.');
    }
  }

  async function handleSaveSettings(nextSettings: OrderSettings) {
    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;
    const sequence = nextSettingsSaveSequence();

    try {
      const savedSettings = await orderRepository.saveSettings(workspaceId, nextSettings);

      if (!isLatestSettingsSave(workspaceId, generation, sequence)) {
        return;
      }

      setSettings(savedSettings);
      setOrders((current) => current.map((order) => evaluateOrder(order, savedSettings)));
      setSaveStatusMessage('');
    } catch (error) {
      if (!isLatestSettingsSave(workspaceId, generation, sequence)) {
        return;
      }

      setSaveStatusMessage('설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      throw error;
    }
  }

  function toggleCapturePanel() {
    setCaptureCollapsed((current) => {
      const next = !current;
      saveCapturePanelCollapsed(next);
      return next;
    });
  }

  function handleCaptureToggleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleCapturePanel();
    }
  }

  if (loadStatus === 'loading') {
    return (
      <main className="appShell appStateShell">
        <p role="status" aria-live="polite">
          주문 데이터를 불러오고 있어요.
        </p>
      </main>
    );
  }

  if (loadStatus === 'error') {
    return (
      <main className="appShell appStateShell">
        <p role="alert">주문 데이터를 불러오지 못했습니다.</p>
      </main>
    );
  }

  return (
      <main className="appShell">
        <header className="appHeader">
          <div>
            <p className="eyebrow">Lyru OMS</p>
            <h1>주문 표준화 작업실</h1>
          </div>
          <div className="headerActions">
            <QuestionNote />
            <button
              type="button"
              className="secondaryButton iconButton settingsIconButton"
              aria-label="관리 설정"
              title="관리 설정"
              onClick={() => setSettingsOpen(true)}
            >
              <span aria-hidden="true">⚙</span>
            </button>
          </div>
        </header>
        {saveStatusMessage ? (
          <p className="appPersistenceStatus" role="status" aria-live="polite">
            {saveStatusMessage}
          </p>
        ) : null}

        <div className="workspaceLayout">
          <section className="capturePanel" aria-label="주문 수집">
            <div className="sectionHeader captureSectionHeader">
              <div>
                <div
                  className="captureTitleToggle"
                  role="button"
                  tabIndex={0}
                  aria-label={captureCollapsed ? '주문 수집 펼치기' : '주문 수집 접기'}
                  aria-expanded={!captureCollapsed}
                  onClick={toggleCapturePanel}
                  onKeyDown={handleCaptureToggleKeyDown}
                >
                  <h2>주문 수집</h2>
                  <span className="captureToggleIcon" aria-hidden="true">
                    {captureCollapsed ? '◂' : '▾'}
                  </span>
                </div>
                <p>원문을 붙여넣고 저장합니다.</p>
              </div>
            </div>
            {captureCollapsed ? null : (
              <div className="capturePanelBody">
                <label className="inlineSelectControl">
                  <span>채널</span>
                  <select value={captureSource} onChange={(event) => setCaptureSource(event.target.value as OrderSource)}>
                    {ORDER_SOURCES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <OrderCaptureForm
                  existingRawTexts={orders.map((order) => order.rawText)}
                  settings={settings}
                  source={captureSource}
                  onSave={handleSaveOrder}
                />
              </div>
            )}
          </section>

          <OrderList
            orders={displayOrders}
            totalOrderCount={orders.length}
            selectedId={selectedId}
            sortMode={sortMode}
            sourceFilter={sourceFilter}
            onSortModeChange={setSortMode}
            onSourceFilterChange={handleSourceFilterChange}
            onSelect={setSelectedId}
            onClearOrders={handleClearOrders}
          />

          <OrderDetail
            order={selectedOrder}
            settings={settings}
            onChange={handleChangeOrder}
            onClose={() => setSelectedId(null)}
          />
        </div>

        <SettingsModal
          open={settingsOpen}
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      </main>
  );
}

export default function App() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const authRepository = useMemo(() => createAuthRepository(supabase), [supabase]);
  const orderRepository = useMemo(() => createOrderRepository(supabase as never), [supabase]);

  return (
    <AuthGate authRepository={authRepository}>
      {(membership) => <WorkspaceApp membership={membership} orderRepository={orderRepository} />}
    </AuthGate>
  );
}
