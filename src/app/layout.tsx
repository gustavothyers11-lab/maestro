import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Maestro",
  description: "Seu assistente de estudos com flashcards e repetição espaçada",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background m-0 p-0 w-full min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
