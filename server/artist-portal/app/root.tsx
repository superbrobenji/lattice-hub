import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { LinksFunction } from "react-router";
import appCss from "./app.css?url";
import { AppLayout } from "./components/layout/AppLayout";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
];

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Lattice Artist Portal</title>
        <Meta />
        <Links />
      </head>
      <body>
        <AppLayout>
          <Outlet />
        </AppLayout>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
