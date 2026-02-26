import "./globals.css";
export const metadata = {
  title: "Money Control Board",
  description: "Personal financial dashboard"
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f5f5f5" }}>
        {children}
      </body>
    </html>
  );
}
