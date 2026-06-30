import { useEffect, useMemo, useState } from 'react';
import { OrderCaptureForm } from './components/OrderCaptureForm';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { QuestionNote } from './components/QuestionNote';
import { SettingsModal } from './components/SettingsModal';
import { type CapturedOrder, type OrderSettings } from './domain/orderTypes';
import { loadOrders, loadSettings, saveOrders, saveSettings } from './domain/storage';

export default function App() {
  const [orders, setOrders] = useState<CapturedOrder[]>(() => loadOrders());
  const [settings, setSettings] = useState<OrderSettings>(() => loadSettings());
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  function handleSaveOrder(order: CapturedOrder) {
    setOrders((current) => [order, ...current]);
    setSelectedId(order.id);
  }

  function handleChangeOrder(nextOrder: CapturedOrder) {
    setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
  }

  function handleSaveSettings(nextSettings: OrderSettings) {
    setSettings(nextSettings);
  }

  return (
    <main className="appShell">
      <header className="appHeader">
        <div>
          <p className="eyebrow">Lyru OMS</p>
          <h1>주문 표준화 작업실</h1>
        </div>
        <button type="button" className="secondaryButton" onClick={() => setSettingsOpen(true)}>
          관리 설정
        </button>
      </header>

      <div className="workspaceLayout">
        <section className="capturePanel" aria-label="주문 수집">
          <QuestionNote />
          <OrderCaptureForm
            existingRawTexts={orders.map((order) => order.rawText)}
            settings={settings}
            onSave={handleSaveOrder}
          />
        </section>

        <OrderList orders={orders} selectedId={selectedId} onSelect={setSelectedId} />

        <OrderDetail order={selectedOrder} settings={settings} onChange={handleChangeOrder} />
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
