import type { Metadata } from "next";
import './globals.css';
import { Chakra_Petch } from 'next/font/google'

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Budget App",
  description: "Personal Budget Management Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={chakraPetch.className}>
      <body className="bg-background text-light">{children}</body>
    </html>
  );
}

