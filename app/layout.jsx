import "./globals.css";

export const metadata = {
  title: "Banking Experience Risk",
  description: "Evidence-backed review of deceptive patterns, customer transparency and regulatory relevance across Indian banking journeys.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
