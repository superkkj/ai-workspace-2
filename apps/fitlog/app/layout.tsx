import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "핏로그 — 러너의 다음 한 켤레",
  description: "잘 맞는 러닝화를 기록하고, 비슷한 조건의 러너에게 물어보세요. 질문에서 선택, 직접 신어 본 후기까지 이어지는 핏로그.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
