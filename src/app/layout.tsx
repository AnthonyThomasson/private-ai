import "./globals.css";
import React from "react";

export default async function RootLayout({
  children,
}: {
  children: React.ReactElement;
}) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        {children}
        <script src="node_modules/flowbite/dist/flowbite.min.js" async></script>
      </body>
    </html>
  );
}
