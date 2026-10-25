import type { Metadata, Viewport } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "TUPrep — CSE selection test prep", template: "%s · TUPrep" },
  description:
    "Practice for the TU Delft CSE Cognitive Skills Test and the TU/e CSE selection tests (September 2027 intake): lessons, adaptive practice, timed mock exams and spaced review.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f13" },
  ],
};

// Applies the saved theme before first paint to avoid a light/dark flash.
const themeScript = `(function(){try{var s=JSON.parse(localStorage.getItem("tuprep:v1")||"null");var t=s&&s.settings&&s.settings.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
