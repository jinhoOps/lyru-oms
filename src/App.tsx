import { type FocusEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createAuthRepository } from './auth/authRepository';
import type { AuthRepository, WorkspaceMembership } from './auth/authTypes';
import { AccountModal } from './components/AccountModal';
import { AuthGate } from './components/AuthGate';
import { ConfirmDialog } from './components/ConfirmDialog';
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
import {
  clearSavedOrderDraft,
  clearLocalOrderData,
  loadRecentOrderCacheSnapshot,
  loadSavedOrderDraft,
  saveOrderDraft,
  saveRecentOrderCache,
} from './domain/localDraftCache';
import { createOrderRepository, type OrderRepository } from './domain/orderRepository';
import { evaluateOrder } from './domain/reviewRules';
import { sortOrders, type OrderSortMode } from './domain/orderSorting';
import { createBrowserSupabaseClient } from './lib/supabaseClient';
import type { OrderSourceFilter } from './components/OrderList';

const CAPTURE_PANEL_COLLAPSED_KEY = 'lyru-oms.capturePanel.collapsed.v1';
const OFFLINE_CACHE_STATUS_MESSAGE = '오프라인 상태입니다. 최근 주문을 읽기 전용으로 보여드려요.';
const READ_ONLY_CACHE_MUTATION_MESSAGE = '오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.';

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

const closeMenuAfterFocusLeaves = (event: FocusEvent<HTMLDivElement>, closeMenu: () => void) => {
  const menuWrap = event.currentTarget;
  const nextFocus = event.relatedTarget;

  if (nextFocus instanceof Node) {
    if (!menuWrap.contains(nextFocus)) {
      closeMenu();
    }

    return;
  }

  window.setTimeout(() => {
    const activeElement = document.activeElement;

    if (!(activeElement instanceof Node) || !menuWrap.contains(activeElement)) {
      closeMenu();
    }
  }, 0);
};

type WorkspaceLoadStatus = 'loading' | 'ready' | 'error' | 'offline-cache';

interface WorkspaceAppProps {
  membership: WorkspaceMembership;
  currentEmail: string;
  authRepository: AuthRepository;
  orderRepository: OrderRepository;
  onSignOut?: () => Promise<void>;
}

export function WorkspaceApp({ membership, currentEmail, authRepository, orderRepository, onSignOut }: WorkspaceAppProps) {
  const [orders, setOrders] = useState<CapturedOrder[]>([]);
  const [settings, setSettings] = useState<OrderSettings>(() => DEFAULT_SETTINGS);
  const [loadStatus, setLoadStatus] = useState<WorkspaceLoadStatus>('loading');
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [saveStatusMessage, setSaveStatusMessage] = useState('');
  const [savedOrderDraft, setSavedOrderDraft] = useState(() => loadSavedOrderDraft());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<OrderSortMode>('desiredDate');
  const [captureSource, setCaptureSource] = useState<OrderSource>(savedOrderDraft?.source ?? '카카오톡 채널');
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('전체');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [captureCollapsed, setCaptureCollapsed] = useState(() => loadCapturePanelCollapsed());
  const currentWorkspaceIdRef = useRef(membership.workspaceId);
  const workspaceGenerationRef = useRef(0);
  const orderSaveSequenceByIdRef = useRef(new Map<string, number>());
  const orderSaveChainByIdRef = useRef(new Map<string, Promise<void>>());
  const settingsSaveSequenceRef = useRef(0);

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

  const enqueueOrderSave = (orderId: string, task: () => Promise<void>) => {
    const previousSave = orderSaveChainByIdRef.current.get(orderId) ?? Promise.resolve();
    const nextSave = previousSave.catch(() => undefined).then(task);
    orderSaveChainByIdRef.current.set(orderId, nextSave);

    nextSave
      .finally(() => {
        if (orderSaveChainByIdRef.current.get(orderId) === nextSave) {
          orderSaveChainByIdRef.current.delete(orderId);
        }
      })
      .catch(() => undefined);

    return nextSave;
  };

  const nextSettingsSaveSequence = () => {
    settingsSaveSequenceRef.current += 1;

    return settingsSaveSequenceRef.current;
  };

  const isLatestSettingsSave = (workspaceId: string, generation: number, sequence: number) =>
    isCurrentWorkspaceGeneration(workspaceId, generation) && settingsSaveSequenceRef.current === sequence;

  const isOfflineCacheReadonly = loadStatus === 'offline-cache';
  const canManageWorkspace = membership.role === 'owner';

  const blockOfflineCacheMutation = () => {
    if (!isOfflineCacheReadonly) {
      return false;
    }

    setSaveStatusMessage(READ_ONLY_CACHE_MUTATION_MESSAGE);
    return true;
  };

  useEffect(() => {
    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current + 1;
    workspaceGenerationRef.current = generation;
    currentWorkspaceIdRef.current = workspaceId;
    orderSaveSequenceByIdRef.current.clear();
    orderSaveChainByIdRef.current.clear();
    settingsSaveSequenceRef.current = 0;

    setLoadStatus('loading');
    setLoadedWorkspaceId(null);
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
        setLoadedWorkspaceId(workspaceId);
        setLoadStatus('ready');
      })
      .catch(() => {
        if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
          return;
        }

        const cachedSnapshot = loadRecentOrderCacheSnapshot(workspaceId);

        if (cachedSnapshot) {
          setOrders(cachedSnapshot.orders);
          setSettings(DEFAULT_SETTINGS);
          setLoadedWorkspaceId(workspaceId);
          setLoadStatus('offline-cache');
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

  useEffect(() => {
    if (loadStatus !== 'ready' || navigator.onLine === false || loadedWorkspaceId !== membership.workspaceId) {
      return;
    }

    const cacheWriteId = window.setTimeout(() => {
      saveRecentOrderCache(membership.workspaceId, orders);
    }, 250);

    return () => window.clearTimeout(cacheWriteId);
  }, [loadStatus, loadedWorkspaceId, membership.workspaceId, orders]);

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
    if (blockOfflineCacheMutation()) {
      return false;
    }

    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;

    try {
      const savedOrder = await orderRepository.saveOrder(workspaceId, order);

      if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
        return false;
      }

      setOrders((current) => [savedOrder, ...current]);
      setSourceFilter(savedOrder.source);
      setSelectedId(savedOrder.id);
      clearSavedOrderDraft();
      setSavedOrderDraft(null);
      setSaveStatusMessage('');
      return true;
    } catch {
      if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
        return false;
      }

      saveOrderDraft(order);
      setSaveStatusMessage('저장하지 못했습니다. 입력 내용은 임시 저장했어요.');
      return false;
    }
  }

  async function handleClearOrders() {
    if (blockOfflineCacheMutation()) {
      return;
    }

    if (!window.confirm('저장된 주문을 모두 삭제할까요?')) {
      return;
    }

    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;
    const orderIdsAtClearStart = orders.map((order) => order.id);
    const orderIdsAtClearStartSet = new Set(orderIdsAtClearStart);

    try {
      await orderRepository.deleteOrders(workspaceId, orderIdsAtClearStart);

      if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
        return;
      }

      setOrders((current) => current.filter((order) => !orderIdsAtClearStartSet.has(order.id)));
      setSelectedId((currentSelectedId) =>
        currentSelectedId && orderIdsAtClearStartSet.has(currentSelectedId) ? null : currentSelectedId,
      );
      setSaveStatusMessage('');
    } catch {
      if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
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
    if (blockOfflineCacheMutation()) {
      return;
    }

    const workspaceId = membership.workspaceId;
    const generation = workspaceGenerationRef.current;
    const sequence = nextOrderSaveSequence(nextOrder.id);
    const previousOrder = orders.find((order) => order.id === nextOrder.id) ?? null;

    setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));

    await enqueueOrderSave(nextOrder.id, async () => {
      if (!isCurrentWorkspaceGeneration(workspaceId, generation)) {
        return;
      }

      try {
        const savedOrder = await orderRepository.saveOrder(workspaceId, nextOrder);

        if (!isLatestOrderSave(workspaceId, generation, nextOrder.id, sequence)) {
          return;
        }

        setOrders((current) => current.map((order) => (order.id === savedOrder.id ? savedOrder : order)));
        setSaveStatusMessage('');
      } catch {
        if (!isLatestOrderSave(workspaceId, generation, nextOrder.id, sequence)) {
          return;
        }

        const restoredOrder = previousOrder;
        if (restoredOrder) {
          setOrders((current) => current.map((order) => (order.id === nextOrder.id ? restoredOrder : order)));
        }
        setSaveStatusMessage('변경 내용을 저장하지 못했습니다. 임시 저장했어요.');
      }
    });
  }

  async function handleSaveSettings(nextSettings: OrderSettings) {
    if (blockOfflineCacheMutation()) {
      throw new Error(READ_ONLY_CACHE_MUTATION_MESSAGE);
    }

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

  async function handleConfirmSignOut() {
    setLogoutConfirmOpen(false);
    await onSignOut?.();
  }

  function openSettingsFromMenu() {
    setWorkspaceMenuOpen(false);
    setSettingsOpen(true);
  }

  function openAccountFromMenu() {
    setWorkspaceMenuOpen(false);
    setAccountOpen(true);
  }

  function openLogoutConfirmFromMenu() {
    setWorkspaceMenuOpen(false);
    setLogoutConfirmOpen(true);
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
            <h1>리루네 과자집</h1>
          </div>
          <div className="headerActions">
            <QuestionNote />
            <div
              className="workspaceMenuWrap"
              onBlur={(event) => closeMenuAfterFocusLeaves(event, () => setWorkspaceMenuOpen(false))}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setWorkspaceMenuOpen(false);
                }
              }}
            >
              <button
                type="button"
                className="secondaryButton iconButton settingsIconButton workspaceMenuButton"
                aria-label="메뉴"
                aria-expanded={workspaceMenuOpen}
                title="메뉴"
                onClick={() => setWorkspaceMenuOpen((current) => !current)}
              >
                <span aria-hidden="true">⚙</span>
              </button>
              {workspaceMenuOpen ? (
                <div className="sortMenu workspaceMenu" role="menu" aria-label="작업실 메뉴">
                  {canManageWorkspace ? (
                    <button type="button" className="actionMenuItem" role="menuitem" onClick={openSettingsFromMenu}>
                      필수 설정
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="actionMenuItem"
                    role="menuitem"
                    onClick={openAccountFromMenu}
                  >
                    계정 관리
                  </button>
                  {onSignOut ? (
                    <button type="button" className="actionMenuItem" role="menuitem" onClick={openLogoutConfirmFromMenu}>
                      로그아웃
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </header>
        {isOfflineCacheReadonly ? (
          <p className="appPersistenceStatus" role="status" aria-live="polite">
            {OFFLINE_CACHE_STATUS_MESSAGE}
          </p>
        ) : null}
        {saveStatusMessage ? (
          <p className="appPersistenceStatus" role="status" aria-live="polite">
            {saveStatusMessage}
          </p>
        ) : null}
        {savedOrderDraft ? (
          <p className="appPersistenceStatus" role="status" aria-live="polite">
            임시 저장된 주문 원문을 복구했어요.
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
                  initialRawText={savedOrderDraft?.rawText}
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
            onClearOrders={canManageWorkspace ? handleClearOrders : undefined}
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
        <AccountModal
          open={accountOpen}
          currentEmail={currentEmail}
          membership={membership}
          authRepository={authRepository}
          onClose={() => setAccountOpen(false)}
        />
        <ConfirmDialog
          open={logoutConfirmOpen}
          title="로그아웃할까요?"
          description="현재 기기에서 로그인 세션을 종료합니다."
          confirmLabel="로그아웃"
          onCancel={() => setLogoutConfirmOpen(false)}
          onConfirm={handleConfirmSignOut}
        />
      </main>
  );
}

export default function App() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const authRepository = useMemo(() => createAuthRepository(supabase), [supabase]);
  const orderRepository = useMemo(() => createOrderRepository(supabase as never), [supabase]);

  return (
    <AuthGate authRepository={authRepository} onBeforeSignOut={clearLocalOrderData}>
      {(membership, { signOut }, session) => (
        <WorkspaceApp
          key={membership.workspaceId}
          membership={membership}
          currentEmail={session.email}
          authRepository={authRepository}
          orderRepository={orderRepository}
          onSignOut={signOut}
        />
      )}
    </AuthGate>
  );
}
