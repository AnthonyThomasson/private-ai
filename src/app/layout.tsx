import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private AI",
  description: "AI powered murder mystery",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        {children}

        <script src="node_modules/flowbite/dist/flowbite.min.js" async></script>
      </body>
    </html>
  );
}
