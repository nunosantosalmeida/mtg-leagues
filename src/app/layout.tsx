import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { createTheme, MantineProvider } from "@mantine/core";

import "./globals.css";
import "@mantine/carousel/styles.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MTG Leagues",
  description: "Track your Magic: The Gathering league standings and results",
};

const theme = createTheme({
  /** Your theme override here */
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.className} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
                const t=localStorage.getItem('theme');
                if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))
                  document.documentElement.classList.add('dark');
                } catch(e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <MantineProvider theme={theme}>
            <Navbar />
            <main className="flex-1 pt-14">{children}</main>
            <Toaster />
          </MantineProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
