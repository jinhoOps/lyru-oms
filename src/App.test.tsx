import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App, { WorkspaceApp } from './App';
import { DEFAULT_SETTINGS, EMPTY_ORDER_FIELDS, type CapturedOrder } from './domain/orderTypes';
import { localDraftCacheKeys, saveOrderDraft, saveRecentOrderCache } from './domain/localDraftCache';

const authRepositoryMock = {
  getSession: vi.fn().mockResolvedValue({ userId: 'user-1', email: 'owner@lyru.test' }),
  signIn: vi.fn().mockResolvedValue({ userId: 'user-1', email: 'owner@lyru.test' }),
  signOut: vi.fn().mockResolvedValue(undefined),
  getWorkspaceMembership: vi.fn().mockResolvedValue({
    workspaceId: 'workspace-1',
    workspaceName: '리루 작업실',
    role: 'owner',
  }),
  onSessionChange: vi.fn(() => vi.fn()),
};

const orderRepositoryMock = {
  loadWorkspaceData: vi.fn().mockResolvedValue({ orders: [], settings: DEFAULT_SETTINGS }),
  saveOrder: vi.fn(async (_workspaceId, order) => order),
  deleteOrders: vi.fn().mockResolvedValue(undefined),
  saveSettings: vi.fn(async (_workspaceId, settings) => settings),
};

vi.mock('./lib/supabaseClient', () => ({
  createBrowserSupabaseClient: vi.fn(() => ({ marker: 'supabase-client' })),
}));

vi.mock('./auth/authRepository', () => ({
  createAuthRepository: vi.fn(() => authRepositoryMock),
}));

vi.mock('./domain/orderRepository', () => ({
  createOrderRepository: vi.fn(() => orderRepositoryMock),
}));

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  vi.clearAllMocks();
  authRepositoryMock.getSession.mockReset();
  authRepositoryMock.signIn.mockReset();
  authRepositoryMock.signOut.mockReset();
  authRepositoryMock.getWorkspaceMembership.mockReset();
  authRepositoryMock.onSessionChange.mockReset();
  orderRepositoryMock.loadWorkspaceData.mockReset();
  orderRepositoryMock.saveOrder.mockReset();
  orderRepositoryMock.deleteOrders.mockReset();
  orderRepositoryMock.saveSettings.mockReset();
  authRepositoryMock.getSession.mockResolvedValue({ userId: 'user-1', email: 'owner@lyru.test' });
  authRepositoryMock.signIn.mockResolvedValue({ userId: 'user-1', email: 'owner@lyru.test' });
  authRepositoryMock.signOut.mockResolvedValue(undefined);
  authRepositoryMock.getWorkspaceMembership.mockResolvedValue({
    workspaceId: 'workspace-1',
    workspaceName: '리루 작업실',
    role: 'owner',
  });
  authRepositoryMock.onSessionChange.mockImplementation(() => vi.fn());
  orderRepositoryMock.loadWorkspaceData.mockResolvedValue({ orders: [], settings: DEFAULT_SETTINGS });
  orderRepositoryMock.saveOrder.mockImplementation(async (_workspaceId, order) => order);
  orderRepositoryMock.deleteOrders.mockResolvedValue(undefined);
  orderRepositoryMock.saveSettings.mockImplementation(async (_workspaceId, settings) => settings);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function renderUnlockedApp() {
  render(<App />);
  await screen.findByRole('heading', { name: '주문 표준화 작업실' }, { timeout: 2000 });
}

async function selectOrderListChannel(user: ReturnType<typeof userEvent.setup>, channel: string) {
  await user.click(screen.getByRole('button', { name: /^채널:/ }));
  await user.click(screen.getByRole('radio', { name: channel }));
}

function getCapturePanel() {
  return within(screen.getByRole('region', { name: '주문 수집' }));
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function createCapturedOrder(overrides: Partial<CapturedOrder> = {}): CapturedOrder {
  const now = '2026-07-06T00:00:00.000Z';

  return {
    id: 'order-1',
    source: '카카오톡 채널',
    rawText: '성함: 레이스고객\n곶감 1세트\n2026-07-06\n픽업',
    ...EMPTY_ORDER_FIELDS,
    customerName: '레이스고객',
    orderItems: '곶감',
    quantity: '1세트',
    fulfillmentType: '픽업',
    desiredDateTime: '2026-07-06',
    menuMatches: [],
    quantityCandidates: [],
    parsedDate: null,
    manuallyEditedFields: [],
    reparseDifferences: [],
    missingFields: [],
    reviewReasons: [],
    warningLevel: 'none',
    status: '신규',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('App', () => {
  it('keeps owner questions hidden behind the header note control', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    expect(screen.getByLabelText('주문/문의 원문')).toBeInTheDocument();
    expect(screen.queryByText('아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.getByRole('region', { name: '확인 질문 쪽지' })).toBeInTheDocument();
    const settingsButton = screen.getByRole('button', { name: '관리 설정' });
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton).toHaveTextContent('⚙');
  });

  it('starts an empty authenticated workspace without sample orders', async () => {
    await renderUnlockedApp();

    expect(screen.getByText('아직 저장된 주문이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/유리루/)).not.toBeInTheDocument();
    expect(screen.queryByText(/나스닥3배/)).not.toBeInTheDocument();
    expect(screen.getByText('0건')).toBeInTheDocument();
    expect(orderRepositoryMock.loadWorkspaceData).toHaveBeenCalledWith('workspace-1');
  });

  it('shows a load failure alert when workspace data cannot be loaded', async () => {
    orderRepositoryMock.loadWorkspaceData.mockRejectedValueOnce(new Error('load failed'));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('주문 데이터를 불러오지 못했습니다.');
    expect(screen.queryByRole('heading', { name: '주문 표준화 작업실' })).not.toBeInTheDocument();
  });

  it('shows cached orders read-only when offline workspace loading fails', async () => {
    const user = userEvent.setup();
    const cachedOrder = createCapturedOrder({
      id: 'cached-order',
      customerName: '캐시고객',
      updatedAt: '2026-07-06T10:00:00.000Z',
    });
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    localStorage.setItem(
      localDraftCacheKeys.recentOrderCache,
      JSON.stringify({
        workspaceId: 'workspace-1',
        cachedAt: new Date().toISOString(),
        orders: [cachedOrder],
      }),
    );
    orderRepositoryMock.loadWorkspaceData.mockRejectedValueOnce(new Error('load failed'));

    render(<App />);

    expect(
      await screen.findByText('오프라인 상태입니다. 최근 주문을 읽기 전용으로 보여드려요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /캐시고객/ })).toBeInTheDocument();

    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 오프라인저장\n곶감 1세트\n2026-07-06\n픽업');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.getByLabelText('주문/문의 원문')).toHaveValue('성함: 오프라인저장\n곶감 1세트\n2026-07-06\n픽업');
    expect(orderRepositoryMock.saveOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /캐시고객/ }));
    fireEvent.change(screen.getByLabelText('사장님 내부 메모'), { target: { value: '수정 시도' } });

    expect(screen.getByText('오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(orderRepositoryMock.saveOrder).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));
    await user.click(screen.getByRole('button', { name: '작업' }));
    await user.click(screen.getByRole('menuitem', { name: '전체 삭제' }));

    expect(screen.getByText('오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(orderRepositoryMock.deleteOrders).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '관리 설정' }));
    await user.click(within(screen.getByRole('dialog', { name: '정보 부족 기준' })).getByRole('button', { name: '저장' }));

    expect(screen.getByText('오프라인 캐시는 읽기 전용입니다. 연결 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(orderRepositoryMock.saveSettings).not.toHaveBeenCalled();
  });

  it('keeps a local draft and shows Korean status when a new order save fails', async () => {
    const user = userEvent.setup();
    const rawText = '성함: 저장실패고객\n곶감 1세트\n2026-07-06\n픽업';
    orderRepositoryMock.saveOrder.mockRejectedValueOnce(new Error('save failed'));

    await renderUnlockedApp();

    await user.type(screen.getByLabelText('주문/문의 원문'), rawText);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장하지 못했습니다. 입력 내용은 임시 저장했어요.')).toBeInTheDocument();
    const draft = JSON.parse(localStorage.getItem('lyru-oms.orderDraft.v1') ?? '{}');
    expect(draft).toEqual(
      expect.objectContaining({
        rawText,
        source: '카카오톡 채널',
        fields: expect.objectContaining({
          customerName: '저장실패고객',
        }),
        savedAt: expect.any(String),
      }),
    );
    expect(draft).not.toHaveProperty('order');
    expect(draft).not.toHaveProperty('reviewReasons');
    expect(draft).not.toHaveProperty('menuMatches');
    expect(screen.queryByText('저장실패고객')).not.toBeInTheDocument();
  });

  it('clears local draft and recent-order cache on blocked-screen logout', async () => {
    const user = userEvent.setup();
    authRepositoryMock.getWorkspaceMembership.mockResolvedValueOnce(null);
    saveOrderDraft(createCapturedOrder());
    saveRecentOrderCache('workspace-1', [createCapturedOrder()]);

    render(<App />);

    await screen.findByRole('heading', { name: '작업실 접근 권한이 없습니다' });
    expect(localStorage.getItem(localDraftCacheKeys.orderDraft)).not.toBeNull();
    expect(localStorage.getItem(localDraftCacheKeys.recentOrderCache)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('heading', { name: 'Lyru OMS 로그인' })).toBeInTheDocument();
    expect(localStorage.getItem(localDraftCacheKeys.orderDraft)).toBeNull();
    expect(localStorage.getItem(localDraftCacheKeys.recentOrderCache)).toBeNull();
  });

  it('clears local draft and recent-order cache on ready workspace logout', async () => {
    const user = userEvent.setup();
    saveOrderDraft(createCapturedOrder());
    saveRecentOrderCache('workspace-1', [createCapturedOrder()]);

    await renderUnlockedApp();
    expect(localStorage.getItem(localDraftCacheKeys.orderDraft)).not.toBeNull();
    expect(localStorage.getItem(localDraftCacheKeys.recentOrderCache)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(authRepositoryMock.signOut).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: 'Lyru OMS 로그인' })).toBeInTheDocument();
    expect(localStorage.getItem(localDraftCacheKeys.orderDraft)).toBeNull();
    expect(localStorage.getItem(localDraftCacheKeys.recentOrderCache)).toBeNull();
  });

  it('updates the recent-order cache after a successful new order save', async () => {
    const user = userEvent.setup();
    const rawText = '성함: 캐시저장고객\n곶감 1세트\n2026-07-06\n픽업';
    orderRepositoryMock.saveOrder.mockImplementationOnce(async (_workspaceId, order) =>
      createCapturedOrder({
        ...order,
        id: 'saved-cache-order',
        rawText,
        customerName: '캐시저장고객',
        updatedAt: '2026-07-06T11:00:00.000Z',
      }),
    );

    await renderUnlockedApp();

    await user.type(screen.getByLabelText('주문/문의 원문'), rawText);
    await user.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => {
      const cache = JSON.parse(localStorage.getItem(localDraftCacheKeys.recentOrderCache) ?? '{}');
      expect(cache).toEqual(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          orders: [expect.objectContaining({ id: 'saved-cache-order', customerName: '캐시저장고객' })],
        }),
      );
    });
  });

  it('updates the recent-order cache after clearing orders so stale orders do not reappear offline', async () => {
    const user = userEvent.setup();
    const existingOrder = createCapturedOrder({ id: 'clear-cache-order', customerName: '삭제될고객' });
    window.confirm = () => true;
    orderRepositoryMock.loadWorkspaceData.mockResolvedValueOnce({ orders: [existingOrder], settings: DEFAULT_SETTINGS });

    await renderUnlockedApp();

    expect(screen.getByRole('button', { name: /삭제될고객/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '작업' }));
    await user.click(screen.getByRole('menuitem', { name: '전체 삭제' }));

    await waitFor(() => {
      const cache = JSON.parse(localStorage.getItem(localDraftCacheKeys.recentOrderCache) ?? '{}');
      expect(cache).toEqual(expect.objectContaining({ workspaceId: 'workspace-1', orders: [] }));
    });

    cleanup();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    orderRepositoryMock.loadWorkspaceData.mockRejectedValueOnce(new Error('load failed'));

    render(<App />);

    expect(
      await screen.findByText('오프라인 상태입니다. 최근 주문을 읽기 전용으로 보여드려요.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('삭제될고객')).not.toBeInTheDocument();
  });

  it('does not write the previous workspace orders into the next workspace cache during a switch', async () => {
    const workspaceOneOrder = createCapturedOrder({
      id: 'workspace-1-order',
      customerName: '작업실1고객',
      updatedAt: '2026-07-06T10:00:00.000Z',
    });
    const workspaceTwoLoad = createDeferred<{ orders: CapturedOrder[]; settings: typeof DEFAULT_SETTINGS }>();
    orderRepositoryMock.loadWorkspaceData
      .mockResolvedValueOnce({ orders: [workspaceOneOrder], settings: DEFAULT_SETTINGS })
      .mockReturnValueOnce(workspaceTwoLoad.promise);

    const { rerender } = render(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-1', workspaceName: '리루 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    expect(await screen.findByRole('button', { name: /작업실1고객/ })).toBeInTheDocument();
    await waitFor(() => {
      const cache = JSON.parse(localStorage.getItem(localDraftCacheKeys.recentOrderCache) ?? '{}');
      expect(cache).toEqual(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          orders: [expect.objectContaining({ id: 'workspace-1-order' })],
        }),
      );
    });

    rerender(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-2', workspaceName: '새 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    await waitFor(() => expect(orderRepositoryMock.loadWorkspaceData).toHaveBeenCalledWith('workspace-2'));

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    await act(async () => {
      workspaceTwoLoad.reject(new Error('offline load failed'));
      await workspaceTwoLoad.promise.catch(() => undefined);
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('주문 데이터를 불러오지 못했습니다.');
    expect(screen.queryByText('작업실1고객')).not.toBeInTheDocument();
    const cache = JSON.parse(localStorage.getItem(localDraftCacheKeys.recentOrderCache) ?? '{}');
    expect(cache.workspaceId).toBe('workspace-1');
    expect(cache.orders).toEqual([expect.objectContaining({ id: 'workspace-1-order' })]);
  });

  it('keeps the latest existing order edit when save responses resolve out of order', async () => {
    const user = userEvent.setup();
    const initialOrder = createCapturedOrder({ id: 'order-race', ownerMemo: '' });
    const slowSave = createDeferred<CapturedOrder>();
    const fastSave = createDeferred<CapturedOrder>();
    orderRepositoryMock.loadWorkspaceData.mockResolvedValueOnce({ orders: [initialOrder], settings: DEFAULT_SETTINGS });
    orderRepositoryMock.saveOrder.mockReturnValueOnce(slowSave.promise).mockReturnValueOnce(fastSave.promise);

    render(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-1', workspaceName: '리루 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    await screen.findByRole('heading', { name: '주문 표준화 작업실' });
    await user.click(await screen.findByRole('button', { name: /레이스고객/ }));

    const ownerMemoInput = screen.getByLabelText('사장님 내부 메모');
    fireEvent.change(ownerMemoInput, { target: { value: '느린 저장' } });
    fireEvent.change(ownerMemoInput, { target: { value: '최신 저장' } });

    await waitFor(() => expect(orderRepositoryMock.saveOrder).toHaveBeenCalledTimes(1));
    expect(orderRepositoryMock.saveOrder).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.objectContaining({ ownerMemo: '느린 저장' }),
    );
    expect(screen.getByDisplayValue('최신 저장')).toBeInTheDocument();

    await act(async () => {
      slowSave.resolve(createCapturedOrder({ id: 'order-race', ownerMemo: '느린 저장' }));
      await slowSave.promise;
    });

    await waitFor(() => expect(orderRepositoryMock.saveOrder).toHaveBeenCalledTimes(2));
    expect(orderRepositoryMock.saveOrder).toHaveBeenLastCalledWith(
      'workspace-1',
      expect.objectContaining({ ownerMemo: '최신 저장' }),
    );
    expect(screen.getByDisplayValue('최신 저장')).toBeInTheDocument();

    await act(async () => {
      fastSave.resolve(createCapturedOrder({ id: 'order-race', ownerMemo: '최신 저장' }));
      await fastSave.promise;
    });

    expect(screen.getByDisplayValue('최신 저장')).toBeInTheDocument();
  });

  it('rolls back an existing order edit when save fails', async () => {
    const user = userEvent.setup();
    const initialOrder = createCapturedOrder({ id: 'order-fail', ownerMemo: '기존 메모' });
    orderRepositoryMock.loadWorkspaceData.mockResolvedValueOnce({ orders: [initialOrder], settings: DEFAULT_SETTINGS });
    orderRepositoryMock.saveOrder.mockRejectedValueOnce(new Error('save failed'));

    render(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-1', workspaceName: '리루 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    await screen.findByRole('heading', { name: '주문 표준화 작업실' });
    await user.click(await screen.findByRole('button', { name: /레이스고객/ }));

    const ownerMemoInput = screen.getByLabelText('사장님 내부 메모');
    fireEvent.change(ownerMemoInput, { target: { value: '저장 실패 메모' } });

    await waitFor(() => expect(orderRepositoryMock.saveOrder).toHaveBeenCalledWith(
      'workspace-1',
      expect.objectContaining({ ownerMemo: '저장 실패 메모' }),
    ));
    expect(await screen.findByText('변경 내용을 저장하지 못했습니다. 임시 저장했어요.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('기존 메모')).toBeInTheDocument();
  });

  it('ignores a new order save response after the workspace changes', async () => {
    const user = userEvent.setup();
    const slowSave = createDeferred<CapturedOrder>();
    orderRepositoryMock.loadWorkspaceData
      .mockResolvedValueOnce({ orders: [], settings: DEFAULT_SETTINGS })
      .mockResolvedValueOnce({ orders: [], settings: DEFAULT_SETTINGS });
    orderRepositoryMock.saveOrder.mockReturnValueOnce(slowSave.promise);
    const { rerender } = render(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-1', workspaceName: '리루 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    await screen.findByRole('heading', { name: '주문 표준화 작업실' });
    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 늦은고객\n곶감 1세트\n2026-07-06\n픽업');
    await user.click(screen.getByRole('button', { name: '저장' }));

    rerender(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-2', workspaceName: '새 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    await waitFor(() => expect(orderRepositoryMock.loadWorkspaceData).toHaveBeenCalledWith('workspace-2'));
    expect(await screen.findByText('아직 저장된 주문이 없습니다.')).toBeInTheDocument();

    await act(async () => {
      slowSave.resolve(createCapturedOrder({ id: 'late-order', customerName: '늦은고객' }));
      await slowSave.promise;
    });

    expect(screen.queryByText('늦은고객')).not.toBeInTheDocument();
    expect(screen.getByText('아직 저장된 주문이 없습니다.')).toBeInTheDocument();
  });

  it('clears all orders from the list action menu', async () => {
    const user = userEvent.setup();
    window.confirm = () => true;

    await renderUnlockedApp();

    expect(screen.queryByRole('button', { name: '전체 삭제' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '작업' }));
    await user.click(screen.getByRole('menuitem', { name: '전체 삭제' }));

    expect(screen.getByText('아직 저장된 주문이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/유리루/)).not.toBeInTheDocument();
    expect(screen.queryByText(/나스닥3배/)).not.toBeInTheDocument();
  });

  it('removes pre-clear orders and keeps an order saved after clear starts', async () => {
    const user = userEvent.setup();
    const existingOrder = createCapturedOrder({ id: 'old-order', customerName: '기존고객' });
    const clearOrders = createDeferred<void>();
    const saveOrder = createDeferred<CapturedOrder>();
    const rawText = '성함: 새고객\n곶감 1세트\n2026-07-06\n픽업';
    window.confirm = () => true;
    orderRepositoryMock.loadWorkspaceData.mockResolvedValueOnce({ orders: [existingOrder], settings: DEFAULT_SETTINGS });
    orderRepositoryMock.deleteOrders.mockReturnValueOnce(clearOrders.promise);
    orderRepositoryMock.saveOrder.mockReturnValueOnce(saveOrder.promise);

    render(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-1', workspaceName: '리루 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    expect(await screen.findByRole('button', { name: /기존고객/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '작업' }));
    await user.click(screen.getByRole('menuitem', { name: '전체 삭제' }));
    expect(orderRepositoryMock.deleteOrders).toHaveBeenCalledWith('workspace-1', ['old-order']);

    await user.type(screen.getByLabelText('주문/문의 원문'), rawText);
    await user.click(screen.getByRole('button', { name: '저장' }));

    await act(async () => {
      saveOrder.resolve(
        createCapturedOrder({
          id: 'new-after-clear',
          rawText,
          customerName: '새고객',
          orderItems: '곶감',
          quantity: '1세트',
        }),
      );
      await saveOrder.promise;
    });

    expect(await screen.findByText('새고객')).toBeInTheDocument();

    await act(async () => {
      clearOrders.resolve();
      await clearOrders.promise;
    });

    expect(screen.getByText('새고객')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /기존고객/ })).not.toBeInTheDocument();
    expect(screen.queryByText('아직 저장된 주문이 없습니다.')).not.toBeInTheDocument();
  });

  it('applies a pending new order save when clear fails after the save starts', async () => {
    const user = userEvent.setup();
    const existingOrder = createCapturedOrder({ id: 'existing-before-clear', customerName: '기존고객' });
    const clearOrders = createDeferred<void>();
    const saveOrder = createDeferred<CapturedOrder>();
    const rawText = '성함: 저장성공고객\n곶감 1세트\n2026-07-06\n픽업';
    window.confirm = () => true;
    orderRepositoryMock.loadWorkspaceData.mockResolvedValueOnce({ orders: [existingOrder], settings: DEFAULT_SETTINGS });
    orderRepositoryMock.deleteOrders.mockReturnValueOnce(clearOrders.promise);
    orderRepositoryMock.saveOrder.mockReturnValueOnce(saveOrder.promise);

    render(
      <WorkspaceApp
        membership={{ workspaceId: 'workspace-1', workspaceName: '리루 작업실', role: 'owner' }}
        orderRepository={orderRepositoryMock}
      />,
    );

    await screen.findByRole('heading', { name: '주문 표준화 작업실' });
    expect(await screen.findByRole('button', { name: /기존고객/ })).toBeInTheDocument();
    await user.type(screen.getByLabelText('주문/문의 원문'), rawText);
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(orderRepositoryMock.saveOrder).toHaveBeenCalledWith('workspace-1', expect.objectContaining({ rawText }));

    await user.click(screen.getByRole('button', { name: '작업' }));
    await user.click(screen.getByRole('menuitem', { name: '전체 삭제' }));
    expect(orderRepositoryMock.deleteOrders).toHaveBeenCalledWith('workspace-1', ['existing-before-clear']);

    await act(async () => {
      clearOrders.reject(new Error('delete failed'));
      await clearOrders.promise.catch(() => undefined);
    });

    expect(screen.getByText('주문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();

    await act(async () => {
      saveOrder.resolve(
        createCapturedOrder({
          id: 'saved-after-clear-failure',
          rawText,
          customerName: '저장성공고객',
          orderItems: '곶감',
          quantity: '1세트',
        }),
      );
      await saveOrder.promise;
    });

    expect(await screen.findByText('저장성공고객')).toBeInTheDocument();
    expect(getCapturePanel().getByLabelText('주문/문의 원문')).toHaveValue('');
    expect(screen.queryByText('주문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')).not.toBeInTheDocument();
  });

  it('collapses order capture and restores the draft state from localStorage', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    expect(screen.getByLabelText('주문/문의 원문')).toBeInTheDocument();
    expect(screen.getByLabelText('채널')).toBeInTheDocument();
    expect(screen.queryByLabelText('출처')).not.toBeInTheDocument();

    const captureToggle = screen.getByRole('button', { name: '주문 수집 접기' });
    expect(within(captureToggle).getByRole('heading', { name: '주문 수집' })).toBeInTheDocument();
    expect(within(captureToggle).getByText('▾')).toBeInTheDocument();
    expect(captureToggle).not.toHaveTextContent('주문 수집 접기');

    await user.click(captureToggle);

    expect(screen.queryByLabelText('주문/문의 원문')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('채널')).not.toBeInTheDocument();
    expect(localStorage.getItem('lyru-oms.capturePanel.collapsed.v1')).toBe('true');

    cleanup();
    await renderUnlockedApp();

    expect(screen.queryByLabelText('주문/문의 원문')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('채널')).not.toBeInTheDocument();
    expect(screen.getByText('◂')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '주문 수집 펼치기' }));

    expect(screen.getByLabelText('주문/문의 원문')).toBeInTheDocument();
    expect(screen.getByLabelText('채널')).toBeInTheDocument();
    expect(localStorage.getItem('lyru-oms.capturePanel.collapsed.v1')).toBe('false');
  });

  it('re-evaluates existing orders when quantity settings change', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    await user.type(
      screen.getByLabelText('주문/문의 원문'),
      `화과자 9구
5세트
2026-07-03
픽업`,
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

    expect(screen.getByText('확인 1개')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '관리 설정' }));
    const settingsDialog = screen.getByRole('dialog', { name: '정보 부족 기준' });
    await user.clear(within(settingsDialog).getByLabelText('대량 기준 실수량'));
    await user.type(within(settingsDialog).getByLabelText('대량 기준 실수량'), '100');
    await user.click(within(settingsDialog).getByRole('button', { name: '저장' }));

    expect(screen.queryByText('확인 1개')).not.toBeInTheDocument();
  });

  it('changes displayed order when sort mode changes', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 작은주문\n곶감 2세트\n2026-07-05\n픽업');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

    await user.clear(screen.getByLabelText('주문/문의 원문'));
    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 큰주문\n곶감 20세트\n2026-07-06\n픽업');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));

    expect(screen.getByText('주문 내용 미정 · 2세트')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '정렬' }));
    await user.click(screen.getByRole('radio', { name: '수량 많은 순' }));

    const orderButtons = screen
      .getAllByRole('button')
      .map((button) => button.textContent ?? '')
      .join('\n');

    expect(orderButtons.indexOf('주문 내용 미정 · 20세트')).toBeLessThan(orderButtons.indexOf('주문 내용 미정 · 2세트'));
  });

  it('saves orders with the source selected from the capture header and filters the order list by source', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    await user.selectOptions(getCapturePanel().getByLabelText('채널'), '네이버 스마트스토어');
    await user.type(getCapturePanel().getByLabelText('주문/문의 원문'), '성함: 스마트고객\n곶감 2세트\n2026-07-05\n픽업');
    await user.click(getCapturePanel().getByRole('button', { name: '저장' }));
    expect(await screen.findByText('스마트고객')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '주문 상세' })).not.toBeInTheDocument());

    await user.selectOptions(getCapturePanel().getByLabelText('채널'), '카카오톡 채널');
    await user.type(getCapturePanel().getByLabelText('주문/문의 원문'), '성함: 카카오고객\n곶감 1세트\n2026-07-06\n픽업');
    await user.click(getCapturePanel().getByRole('button', { name: '저장' }));
    expect(await screen.findByText('카카오고객')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '주문 상세 닫기' }));
    expect(orderRepositoryMock.saveOrder).toHaveBeenCalledTimes(2);

    await selectOrderListChannel(user, '네이버 스마트스토어');

    expect(screen.getByText('주문 내용 미정 · 2세트')).toBeInTheDocument();
    expect(screen.queryByText('주문 내용 미정 · 1세트')).not.toBeInTheDocument();
    expect(screen.getByText('1건')).toBeInTheDocument();
  });

  it('keeps newly saved orders visible by moving the source filter to the saved source', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    await selectOrderListChannel(user, '네이버예약');
    await user.selectOptions(screen.getByLabelText('채널'), '카카오톡 채널');
    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 카카오고객\n곶감 1세트\n2026-07-06\n픽업');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getByRole('button', { name: '채널: 카카오톡 채널' })).toBeInTheDocument();
    const detailDialog = screen.getByRole('dialog', { name: '주문 상세' });
    expect(detailDialog).toBeInTheDocument();
    expect(within(detailDialog).getByText('카카오고객')).toBeInTheDocument();
  });

  it('closes detail when source filter excludes the selected order', async () => {
    const user = userEvent.setup();

    await renderUnlockedApp();

    await user.selectOptions(screen.getByLabelText('채널'), '카카오톡 채널');
    await user.type(screen.getByLabelText('주문/문의 원문'), '성함: 카카오고객\n곶감 1세트\n2026-07-06\n픽업');
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(screen.getByRole('dialog', { name: '주문 상세' })).toBeInTheDocument();

    await selectOrderListChannel(user, '네이버예약');

    expect(screen.queryByRole('dialog', { name: '주문 상세' })).not.toBeInTheDocument();
    expect(screen.getByText('선택한 채널의 주문이 없습니다.')).toBeInTheDocument();
  });
});
