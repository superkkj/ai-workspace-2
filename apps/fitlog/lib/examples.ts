import type { QuestionDetail } from "./contracts";

// Fictional walkthroughs only. Never insert these records into the database or live counts.
export const EXAMPLE_DETAILS: QuestionDetail[] = [
  {
    item: {
      id: "example-fit", title: "발볼이 넓은 편인데, 다음 신발은 어떻게 골라야 할까요?",
      body: "지금 신는 예시 모델 A는 길이는 잘 맞지만, 오래 신으면 앞쪽이 조금 답답해요. 비슷한 착용감을 느꼈던 분은 다음 신발을 고를 때 어떤 부분을 직접 확인하셨나요?\n\n이 글과 답변은 사용 흐름을 설명하기 위한 가상 예시입니다.",
      purpose: "daily", width: "wide", targetModel: "예시 모델 B",
      reference: { brand: "예시 브랜드", model: "데일리 A", size: 270, width: "wide", fit: "tight" },
      nickname: "예시 러너 01", status: "open", createdAt: "2026-11-18T00:00:00.000Z",
      replyCount: 1, isMine: false, choice: null, review: null,
    },
    answers: [{ id: "example-answer-1", body: "저라면 지금 신발에서 길이와 발볼 중 어느 쪽이 불편한지 먼저 구분해 적어 둘 것 같아요. 같은 사이즈라도 모델마다 착용감이 달라 직접 신어 본 경험을 함께 남기면 비교하기 좋아요. (가상 답변)", nickname: "예시 러너 02", reference: null, isMine: false, createdAt: "2026-11-18T01:00:00.000Z" }],
  },
  {
    item: {
      id: "example-choice", title: "주말에 오래 달릴 한 켤레, 매장에서 신어 보고 골랐어요",
      body: "평소에 신는 신발을 기준으로 두 후보를 비교해 보고 싶었어요. 제 용도와 착용감을 적어 질문한 뒤, 매장에서 직접 신어 본 모델을 선택 기록으로 남겼습니다.\n\n아래 선택은 기능을 보여 주는 가상 기록입니다.",
      purpose: "long", width: "regular", targetModel: "예시 모델 C",
      reference: { brand: "예시 브랜드", model: "데일리 A", size: 255, width: "regular", fit: "good" },
      nickname: "예시 러너 03", status: "chosen", createdAt: "2026-11-16T00:00:00.000Z",
      replyCount: 0, isMine: false,
      choice: { brand: "예시 브랜드", model: "롱런 C", size: 255, createdAt: "2026-11-17T00:00:00.000Z" },
      review: null,
    },
    answers: [],
  },
  {
    item: {
      id: "example-review", title: "고민했던 사이즈, 직접 달려 본 뒤의 느낌을 남겨요",
      body: "질문할 때 적었던 조건과 실제로 신어 본 느낌을 한곳에 남기고 싶었어요. 선택만 기록하고 끝내지 않고, 사용 시작일과 착용감을 후기까지 이어 적어 봤습니다.\n\n제조사 정보나 실제 구매 후기가 아닌 가상 예시입니다.",
      purpose: "daily", width: "narrow", targetModel: "예시 모델 D",
      reference: { brand: "예시 브랜드", model: "데일리 A", size: 245, width: "narrow", fit: "loose" },
      nickname: "예시 러너 04", status: "reviewed", createdAt: "2026-11-01T00:00:00.000Z",
      replyCount: 0, isMine: false,
      choice: { brand: "예시 브랜드", model: "데일리 D", size: 245, createdAt: "2026-11-03T00:00:00.000Z" },
      review: { body: "처음 질문에 썼던 헐거운 느낌이 어떤 상황에서 생겼는지 생각하며 사용 기록을 남겼어요. 이 문장은 후기 입력 화면을 설명하는 가상 내용이며 특정 제품의 성능을 뜻하지 않습니다.", fit: "good", distanceKm: null, firstUsedAt: "2026-11-04", daysUsed: 14, createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z" },
    },
    answers: [],
  },
];
