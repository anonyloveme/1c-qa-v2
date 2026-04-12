import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "1C Enterprise QA Chatbot",
  description: "Chatbot tra cứu tài liệu 1C:Enterprise - 1C Expert AI via HoangAnhVnua",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔶</text></svg>",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} bg-white text-gray-900`}>{children}</body>
    </html>
  );
}