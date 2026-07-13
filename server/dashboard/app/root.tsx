import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import type { Route } from "./+types/root";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const message = isRouteErrorResponse(error)
    ? error.status === 404
      ? "404 — Page not found"
      : error.statusText || "Error"
    : error instanceof Error
    ? (import.meta.env.DEV ? error.message : "An unexpected error occurred")
    : "An unexpected error occurred";

  return (
    <main className="flex items-center justify-center min-h-screen bg-base">
      <div className="text-center p-8">
        <h1 className="text-2xl font-bold text-text mb-2">Something went wrong</h1>
        <p className="text-muted">{message}</p>
      </div>
    </main>
  );
}
