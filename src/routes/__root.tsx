import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NotFound } from "@/components/NotFound";

import appCss from "../styles.css?url";

const OG_BASE = ((import.meta.env.VITE_SITE_URL as string | undefined) ?? "").replace(/\/$/, "");

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Padelion, padel in Kemang" },
      { name: "description", content: "Book a padel court in Kemang, South Jakarta, in about 60 seconds." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Padelion" },
      { property: "og:title", content: "Padelion, your court locked in 60 seconds." },
      { property: "og:description", content: "Book and pay for a padel court in Kemang in about 60 seconds. No account, no WhatsApp back and forth." },
      { property: "og:image", content: `${OG_BASE}/og-padelion.jpg` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${OG_BASE}/og-padelion.jpg` },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: "https://api.fontshare.com/v2/css?f[]=satoshi@500,700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  notFoundComponent: NotFound,
  component: RootComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

// Keep this root providers-only: canvas preview routes (/__mockup,
// /__component) render inside it, so any chrome leaks into every frame.
function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
