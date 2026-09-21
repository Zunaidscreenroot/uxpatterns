import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Banking UX Auditor",
  description: "India-focused UX and responsible-banking audit",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
