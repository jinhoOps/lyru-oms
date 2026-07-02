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
    expect(screen.getByText('몇 개부터 미리 확인해야 하는 큰 주문으로 보시나요?')).toBeInTheDocument();
    expect(screen.getByText('고객님들이 이름, 연락처, 주소 같은 정보를 보통 어떤 표현으로 적어주시나요?')).toBeInTheDocument();
    expect(screen.getByText('어떤 표현이 있으면 맞춤 요청으로 따로 확인해야 하나요?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '사장님께 확인할 질문' }));

    expect(screen.queryByRole('region', { name: '확인 질문 쪽지' })).not.toBeInTheDocument();
  });
});
