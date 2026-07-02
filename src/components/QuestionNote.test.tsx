import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { QuestionNote } from './QuestionNote';

afterEach(() => {
  cleanup();
});

describe('QuestionNote', () => {
  it('shows questions only while the note popover is open', async () => {
    const user = userEvent.setup();

    render(<QuestionNote />);

    expect(screen.getByRole('button', { name: '사장님께 확인할 질문' })).toBeInTheDocument();
    expect(screen.queryByText('아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.getByRole('region', { name: '확인 질문 쪽지' })).toBeInTheDocument();
    expect(screen.getByText('현재는 총 40구(낱개 기준) 이상을 대량 주문으로 감지하고 있습니다. 사장님이 생각하시는 \'큰 주문\'의 기준은 몇 구(또는 몇 세트)부터인가요?')).toBeInTheDocument();
    expect(screen.getByText('고객님들이 이름, 연락처, 주소 등을 보내주시는 다양한 형태를 파악할 수 있도록, 실제 주문 메시지 예시를 최대한 많이 공유해 주시면 큰 도움이 됩니다!')).toBeInTheDocument();
    expect(screen.getByText('어떤 단어나 표현(예: "덜 달게", "보자기 포장" 등)이 있을 때 맞춤 요청으로 따로 분류해 사장님께 확인을 요청하도록 설정해 둘까요?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.queryByRole('region', { name: '확인 질문 쪽지' })).not.toBeInTheDocument();
  });
});
