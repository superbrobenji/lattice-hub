import { type RouteConfig, route, layout } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
  ...await flatRoutes({ ignoredRouteFiles: ["**/_auth.server-controls.tsx"] }),
  layout("routes/_auth.tsx", { id: "routes/_auth-server-wrapper" }, [
    route("server", "routes/_auth.server-controls.tsx"),
  ]),
] satisfies RouteConfig;
