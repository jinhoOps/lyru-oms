import { useEffect, useMemo, useState } from 'react';
import { OrderCaptureForm } from './components/OrderCaptureForm';
import { AccessGate } from './components/AccessGate';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { QuestionNote } from './components/QuestionNote';
import { SettingsModal } from './components/SettingsModal';
import { type CapturedOrder, type OrderSettings } from './domain/orderTypes';
import { evaluateOrder } from './domain/reviewRules';
import { sortOrders, type OrderSortMode } from './domain/orderSorting';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './domain/storage';

export default function App() {
  const [orders, setOrders] = useState<CapturedOrder[]>(() => loadOrders());
  const [settings, setSettings] = useState<OrderSettings>(() => loadSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<OrderSortMode>('desiredDate');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId],
  );
  const displayOrders = useMemo(() => sortOrders(orders, sortMode), [orders, sortMode]);

  function handleSaveOrder(order: CapturedOrder) {
    setOrders((current) => [order, ...current]);
    setSelectedId(order.id);
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
              <h2>주문 수집</h2>
              <p>원문을 붙여넣고 저장합니다.</p>
            </div>
            <OrderCaptureForm
              existingRawTexts={orders.map((order) => order.rawText)}
              settings={settings}
              onSave={handleSaveOrder}
            />
          </section>

          <OrderList
            orders={displayOrders}
            selectedId={selectedId}
            sortMode={sortMode}
            onSortModeChange={setSortMode}
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
