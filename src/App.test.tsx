import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { DEFAULT_SETTINGS } from './domain/orderTypes';

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
  deleteAllOrders: vi.fn().mockResolvedValue(undefined),
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
  vi.clearAllMocks();
  authRepositoryMock.getSession.mockResolvedValue({ userId: 'user-1', email: 'owner@lyru.test' });
  authRepositoryMock.getWorkspaceMembership.mockResolvedValue({
    workspaceId: 'workspace-1',
    workspaceName: '리루 작업실',
    role: 'owner',
  });
  orderRepositoryMock.loadWorkspaceData.mockResolvedValue({ orders: [], settings: DEFAULT_SETTINGS });
  orderRepositoryMock.saveOrder.mockImplementation(async (_workspaceId, order) => order);
  orderRepositoryMock.deleteAllOrders.mockResolvedValue(undefined);
  orderRepositoryMock.saveSettings.mockImplementation(async (_workspaceId, settings) => settings);
});

afterEach(() => {
  cleanup();
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

  it('keeps a local draft and shows Korean status when a new order save fails', async () => {
    const user = userEvent.setup();
    const rawText = '성함: 저장실패고객\n곶감 1세트\n2026-07-06\n픽업';
    orderRepositoryMock.saveOrder.mockRejectedValueOnce(new Error('save failed'));

    await renderUnlockedApp();

    await user.type(screen.getByLabelText('주문/문의 원문'), rawText);
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장하지 못했습니다. 입력 내용은 임시 저장했어요.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('lyru-oms.orderDraft.v1') ?? '{}').order.rawText).toBe(rawText);
    expect(screen.queryByText('저장실패고객')).not.toBeInTheDocument();
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
