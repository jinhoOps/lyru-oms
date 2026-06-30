import { useState } from 'react';

const questions = [
  '몇 개부터 미리 확인해야 하는 큰 주문으로 보시나요?',
  '택배 주문에서 꼭 빠지면 안 되는 정보는 무엇인가요?',
  '픽업 주문에서 꼭 빠지면 안 되는 정보는 무엇인가요?',
  '주문 메시지에서 자주 빠지는 정보는 무엇인가요?',
  '고객님들이 이름, 연락처, 주소 같은 정보를 보통 어떤 표현으로 적어주시나요?',
  '어떤 표현이 있으면 맞춤 요청으로 따로 확인해야 하나요?',
];

export function QuestionNote() {
  const [open, setOpen] = useState(true);

  return (
    <section className="questionNote" aria-label="확인 질문 쪽지">
      <button type="button" className="noteToggle" onClick={() => setOpen((value) => !value)}>
        사장님께 확인할 질문 {open ? '접기' : '보기'}
      </button>
      {open ? (
        <div className="noteBody">
          <p>아래 질문을 보시고 편하실 때 직접 연락으로 알려주세요.</p>
          <ul>
            {questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
