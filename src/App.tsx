import { type KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { OrderCaptureForm } from './components/OrderCaptureForm';
import { AccessGate } from './components/AccessGate';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { QuestionNote } from './components/QuestionNote';
import { SettingsModal } from './components/SettingsModal';
import {
  EMPTY_ORDER_FIELDS,
  ORDER_SOURCES,
  type CapturedOrder,
  type OrderSettings,
  type OrderSource,
} from './domain/orderTypes';
import { evaluateOrder } from './domain/reviewRules';
import { sortOrders, type OrderSortMode } from './domain/orderSorting';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './domain/storage';
import type { OrderSourceFilter } from './components/OrderList';

const CAPTURE_PANEL_COLLAPSED_KEY = 'lyru-oms.capturePanel.collapsed.v1';

const createSampleOrder = (): CapturedOrder => ({
  ...EMPTY_ORDER_FIELDS,
  id: 'sample-yuriru',
  source: '인스타그램',
  rawText: '성함: 유리루\n상품: 곶감말이 4구 세트\n수량: 2세트\n희망일: 2026-07-04\n수령 방식: 픽업',
  customerName: '유리루',
  orderItems: '곶감말이 4구 세트',
  quantity: '2세트',
  fulfillmentType: '픽업',
  desiredDateTime: '2026-07-04',
  pickupTime: '15:00',
  menuMatches: [],
  quantityCandidates: [{ value: 2, unit: '세트', rawText: '2세트' }],
  parsedDate: {
    isoDate: '2026-07-04',
    timeText: '',
    originalText: '2026-07-04',
    isRelative: false,
  },
  manuallyEditedFields: [],
  reparseDifferences: [],
  missingFields: [],
  reviewReasons: [],
  warningLevel: 'none',
  status: '신규',
  createdAt: '2026-07-03T00:00:00.000Z',
  updatedAt: '2026-07-03T00:00:00.000Z',
});

const loadInitialOrders = () => {
  const storedOrders = loadOrders();

  return storedOrders.length > 0 ? storedOrders : [createSampleOrder()];
};

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

export default function App() {
  const [orders, setOrders] = useState<CapturedOrder[]>(() => loadInitialOrders());
  const [settings, setSettings] = useState<OrderSettings>(() => loadSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<OrderSortMode>('desiredDate');
  const [captureSource, setCaptureSource] = useState<OrderSource>('카카오톡 채널');
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('전체');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [captureCollapsed, setCaptureCollapsed] = useState(() => loadCapturePanelCollapsed());

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const filteredOrders = useMemo(
    () => (sourceFilter === '전체' ? orders : orders.filter((order) => order.source === sourceFilter)),
    [orders, sourceFilter],
  );
  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedId) ?? null,
    [filteredOrders, selectedId],
  );
  const displayOrders = useMemo(() => sortOrders(filteredOrders, sortMode), [filteredOrders, sortMode]);

  function handleSaveOrder(order: CapturedOrder) {
    setOrders((current) => [order, ...current]);
    setSourceFilter(order.source);
    setSelectedId(order.id);
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

  function handleChangeOrder(nextOrder: CapturedOrder) {
    setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
  }

  function handleSaveSettings(nextSettings: OrderSettings) {
    setSettings(nextSettings);
    setOrders((current) => current.map((order) => evaluateOrder(order, nextSettings)));
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

  return (
    <AccessGate>
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
                    {captureCollapsed ? '▸' : '▾'}
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
    </AccessGate>
  );
}
