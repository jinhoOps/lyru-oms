import { useEffect, useMemo, useState } from 'react';
import { OrderCaptureForm } from './components/OrderCaptureForm';
import { AccessGate } from './components/AccessGate';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { QuestionNote } from './components/QuestionNote';
import { SettingsModal } from './components/SettingsModal';
import {
  ORDER_SOURCES,
  type CapturedOrder,
  type OrderSettings,
  type OrderSource,
} from './domain/orderTypes';
import { evaluateOrder } from './domain/reviewRules';
import { sortOrders, type OrderSortMode } from './domain/orderSorting';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './domain/storage';
import type { OrderSourceFilter } from './components/OrderList';

export default function App() {
  const [orders, setOrders] = useState<CapturedOrder[]>(() => loadOrders());
  const [settings, setSettings] = useState<OrderSettings>(() => loadSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<OrderSortMode>('desiredDate');
  const [captureSource, setCaptureSource] = useState<OrderSource>('카카오톡 채널');
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>('전체');
  const [settingsOpen, setSettingsOpen] = useState(false);

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
            <button type="button" className="secondaryButton" onClick={() => setSettingsOpen(true)}>
              관리 설정
            </button>
          </div>
        </header>

        <div className="workspaceLayout">
          <section className="capturePanel" aria-label="주문 수집">
            <div className="sectionHeader">
              <div>
                <h2>주문 수집</h2>
                <p>원문을 붙여넣고 저장합니다.</p>
              </div>
              <div className="sectionHeaderActions">
                <label className="headerSelectControl">
                  출처
                  <select value={captureSource} onChange={(event) => setCaptureSource(event.target.value as OrderSource)}>
                    {ORDER_SOURCES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <OrderCaptureForm
              existingRawTexts={orders.map((order) => order.rawText)}
              settings={settings}
              source={captureSource}
              onSave={handleSaveOrder}
            />
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
