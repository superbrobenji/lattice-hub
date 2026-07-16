import { PassThrough } from "node:stream";
import { createReadableStreamFromReadable } from "@react-router/node";
import { Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration, ServerRouter, UNSAFE_withComponentProps, useFetcher, useLoaderData } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { Background, Controls, Handle, Position, ReactFlow, useEdgesState, useNodesState } from "@xyflow/react";
import dagre from "@dagrejs/dagre";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region node_modules/@react-router/dev/dist/config/defaults/entry.server.node.tsx
var entry_server_node_exports = /* @__PURE__ */ __exportAll({
	default: () => handleRequest,
	streamTimeout: () => streamTimeout
});
var streamTimeout = 5e3;
function handleRequest(request, responseStatusCode, responseHeaders, routerContext, loadContext) {
	if (request.method.toUpperCase() === "HEAD") return new Response(null, {
		status: responseStatusCode,
		headers: responseHeaders
	});
	return new Promise((resolve, reject) => {
		let shellRendered = false;
		let userAgent = request.headers.get("user-agent");
		let readyOption = userAgent && isbot(userAgent) || routerContext.isSpaMode ? "onAllReady" : "onShellReady";
		let timeoutId = setTimeout(() => abort(), 6e3);
		const { pipe, abort } = renderToPipeableStream(/* @__PURE__ */ jsx(ServerRouter, {
			context: routerContext,
			url: request.url
		}), {
			[readyOption]() {
				shellRendered = true;
				const body = new PassThrough({ final(callback) {
					clearTimeout(timeoutId);
					timeoutId = void 0;
					callback();
				} });
				const stream = createReadableStreamFromReadable(body);
				responseHeaders.set("Content-Type", "text/html");
				pipe(body);
				resolve(new Response(stream, {
					headers: responseHeaders,
					status: responseStatusCode
				}));
			},
			onShellError(error) {
				reject(error);
			},
			onError(error) {
				responseStatusCode = 500;
				if (shellRendered) console.error(error);
			}
		});
	});
}
//#endregion
//#region app/app.css?url
var app_default = "/assets/app-CFfvYGzs.css";
//#endregion
//#region app/components/layout/NavBar.tsx
var NAV_ITEMS = [
	{
		to: "/",
		label: "Live Tracker",
		end: true
	},
	{
		to: "/zones",
		label: "Zones",
		end: false
	},
	{
		to: "/enrollments",
		label: "Enrollments",
		end: false
	},
	{
		to: "/api-docs",
		label: "API Reference",
		end: false
	},
	{
		to: "/guides",
		label: "Integration Guides",
		end: false
	}
];
function NavBar() {
	return /* @__PURE__ */ jsxs("nav", {
		className: "bg-surface border-b border-border px-6 h-14 flex items-center gap-1",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-accent font-semibold text-sm tracking-tight mr-6",
			children: "Lattice"
		}), NAV_ITEMS.map(({ to, label, end }) => /* @__PURE__ */ jsx(NavLink, {
			to,
			end,
			className: ({ isActive }) => `px-3 py-1.5 rounded text-sm transition-colors ${isActive ? "bg-elevated text-white" : "text-muted hover:text-white hover:bg-elevated"}`,
			children: label
		}, to))]
	});
}
//#endregion
//#region app/components/layout/AppLayout.tsx
function AppLayout({ children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen bg-base text-white",
		children: [/* @__PURE__ */ jsx(NavBar, {}), /* @__PURE__ */ jsx("main", {
			className: "max-w-[1400px] mx-auto px-6 py-6",
			children
		})]
	});
}
//#endregion
//#region app/root.tsx
var root_exports = /* @__PURE__ */ __exportAll({
	default: () => root_default,
	links: () => links
});
var links = () => [{
	rel: "stylesheet",
	href: app_default
}, {
	rel: "icon",
	href: "/favicon.ico",
	type: "image/x-icon"
}];
var root_default = UNSAFE_withComponentProps(function Root() {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsxs("head", { children: [
			/* @__PURE__ */ jsx("meta", { charSet: "utf-8" }),
			/* @__PURE__ */ jsx("meta", {
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			}),
			/* @__PURE__ */ jsx("title", { children: "Lattice Artist Portal" }),
			/* @__PURE__ */ jsx(Meta, {}),
			/* @__PURE__ */ jsx(Links, {})
		] }), /* @__PURE__ */ jsxs("body", { children: [
			/* @__PURE__ */ jsx(AppLayout, { children: /* @__PURE__ */ jsx(Outlet, {}) }),
			/* @__PURE__ */ jsx(ScrollRestoration, {}),
			/* @__PURE__ */ jsx(Scripts, {})
		] })]
	});
});
//#endregion
//#region app/services/orchestrator.server.ts
var BASE_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8080";
var API_KEY = process.env.API_KEY ?? "";
var ADMIN_KEY = process.env.ADMIN_KEY ?? API_KEY;
async function serverFetch(path) {
	const headers = API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
	const res = await fetch(`${BASE_URL}${path}`, { headers });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const body = await res.json();
	if (!body.success) throw new Error(body.error ?? "API error");
	return body.data;
}
async function serverMutate(path, method, body, admin = false) {
	const key = admin ? ADMIN_KEY : API_KEY;
	const headers = {
		"Content-Type": "application/json",
		...key ? { Authorization: `Bearer ${key}` } : {}
	};
	const res = await fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body: body !== void 0 ? JSON.stringify(body) : void 0
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = await res.json();
	if (!json.success) throw new Error(json.error ?? "API error");
	return json.data;
}
async function serverCommand(path, body) {
	const headers = {
		"Content-Type": "application/json",
		...API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}
	};
	const res = await fetch(`${BASE_URL}${path}`, {
		method: "POST",
		headers,
		body: JSON.stringify(body)
	});
	const json = await res.json();
	if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
	return json;
}
function getNodes() {
	return serverFetch("/api/v1/nodes");
}
function getStatus() {
	return serverFetch("/api/v1/status");
}
function updateNode(id, patch) {
	return serverMutate(`/api/v1/nodes/${id}`, "PATCH", patch);
}
function deleteNode(id) {
	return serverMutate(`/api/v1/nodes/${id}`, "DELETE", void 0, true);
}
function getZones() {
	return serverFetch("/api/v1/zones");
}
function createZone(name) {
	return serverMutate("/api/v1/zones", "POST", { name });
}
function updateZone(id, name) {
	return serverMutate(`/api/v1/zones/${id}`, "PATCH", { name });
}
function deleteZone(id) {
	return serverMutate(`/api/v1/zones/${id}`, "DELETE", void 0, true);
}
function getPendingEnrollments() {
	return serverFetch("/api/v1/enrollments/pending");
}
function getAllEnrollments() {
	return serverFetch("/api/v1/enrollments");
}
function approveEnrollment(mac, params) {
	return serverMutate(`/api/v1/enrollments/${encodeURIComponent(mac)}/approve`, "POST", params, true);
}
function rejectEnrollment(mac) {
	return serverMutate(`/api/v1/enrollments/${encodeURIComponent(mac)}/reject`, "POST", void 0, true);
}
function sendNodeCommand$1(id, body) {
	return serverCommand(`/api/v1/nodes/${id}/command`, body);
}
function sendZoneCommand$1(id, body) {
	return serverCommand(`/api/v1/zones/${id}/command`, body);
}
//#endregion
//#region app/routes/enrollments-approve.ts
var enrollments_approve_exports = /* @__PURE__ */ __exportAll({ action: () => action$8 });
async function action$8({ request }) {
	const body = await request.json();
	try {
		await approveEnrollment(body.mac, {
			name: body.name,
			zone: body.zone,
			type: body.type,
			nodeId: body.nodeId
		});
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/enrollments-reject.ts
var enrollments_reject_exports = /* @__PURE__ */ __exportAll({ action: () => action$7 });
async function action$7({ request }) {
	const body = await request.json();
	try {
		await rejectEnrollment(body.mac);
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/nodes-command.ts
var nodes_command_exports = /* @__PURE__ */ __exportAll({ action: () => action$6 });
async function action$6({ request }) {
	const body = await request.json();
	try {
		const data = await sendNodeCommand$1(body.id, {
			action: body.action,
			colour: body.colour
		});
		return Response.json(data, { status: 202 });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/nodes-refresh.ts
var nodes_refresh_exports = /* @__PURE__ */ __exportAll({ loader: () => loader$3 });
async function loader$3() {
	const nodes = await getNodes();
	return Response.json({ nodes });
}
//#endregion
//#region app/routes/zones-command.ts
var zones_command_exports = /* @__PURE__ */ __exportAll({ action: () => action$5 });
async function action$5({ request }) {
	const body = await request.json();
	try {
		const data = await sendZoneCommand$1(body.id, {
			action: body.action,
			colour: body.colour
		});
		return Response.json(data, { status: 202 });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/nodes-delete.ts
var nodes_delete_exports = /* @__PURE__ */ __exportAll({ action: () => action$4 });
async function action$4({ request }) {
	const body = await request.json();
	try {
		await deleteNode(body.id);
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/zones-delete.ts
var zones_delete_exports = /* @__PURE__ */ __exportAll({ action: () => action$3 });
async function action$3({ request }) {
	const body = await request.json();
	try {
		await deleteZone(body.id);
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/zones-update.ts
var zones_update_exports = /* @__PURE__ */ __exportAll({ action: () => action$2 });
async function action$2({ request }) {
	const body = await request.json();
	try {
		await updateZone(body.id, body.name);
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/components/ui/SlidePanel.tsx
function SlidePanel({ open, onClose, title, children, width = "w-80" }) {
	useEffect(() => {
		if (!open) return;
		const handler = (e) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);
	if (!open) return null;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-20",
		onClick: onClose,
		"aria-hidden": "true"
	}), /* @__PURE__ */ jsxs("div", {
		className: `fixed right-0 top-0 h-full ${width} bg-surface border-l border-border flex flex-col z-30 shadow-2xl`,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between px-4 py-3 border-b border-border shrink-0",
			children: [/* @__PURE__ */ jsx("h3", {
				className: "text-sm font-semibold truncate pr-2",
				children: title
			}), /* @__PURE__ */ jsx("button", {
				onClick: onClose,
				className: "text-muted hover:text-white transition-colors shrink-0 text-lg leading-none",
				"aria-label": "Close",
				children: "✕"
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "flex-1 overflow-y-auto",
			children
		})]
	})] });
}
//#endregion
//#region app/components/ui/Badge.tsx
var variantMap = {
	default: "bg-elevated text-muted",
	type: "bg-elevated text-accent border border-accent/30",
	zone: "bg-elevated text-muted border border-border"
};
function Badge({ children, variant = "default" }) {
	return /* @__PURE__ */ jsx("span", {
		className: `inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantMap[variant]}`,
		children
	});
}
//#endregion
//#region app/components/features/EnrollmentTable.tsx
var STATUS_LABELS = {
	0: "pending",
	1: "approved",
	2: "rejected"
};
var STATUS_VARIANTS = {
	0: "type",
	1: "zone",
	2: "type"
};
var DEFAULT_TYPES = [
	"pir",
	"led",
	"relay",
	"unknown"
];
function EnrollmentTable({ enrollments, zones, nextFreeId, showActions }) {
	const approveFetcher = useFetcher();
	const rejectFetcher = useFetcher();
	const [approveForm, setApproveForm] = useState(null);
	const [confirmReject, setConfirmReject] = useState(null);
	function openApprove(enrollment) {
		setApproveForm({
			mac: enrollment.mac,
			name: "",
			zone: "",
			type: "unknown",
			nodeId: String(nextFreeId || "")
		});
	}
	function submitApprove(e) {
		e.preventDefault();
		if (!approveForm) return;
		approveFetcher.submit(JSON.stringify({
			mac: approveForm.mac,
			name: approveForm.name || void 0,
			zone: approveForm.zone || void 0,
			type: approveForm.type || void 0,
			nodeId: approveForm.nodeId ? parseInt(approveForm.nodeId, 10) : void 0
		}), {
			method: "POST",
			action: "/enrollments-approve",
			encType: "application/json"
		});
	}
	const approveSubmitting = approveFetcher.state === "submitting";
	useEffect(() => {
		if (approveFetcher.data?.ok) setApproveForm(null);
	}, [approveFetcher.data]);
	useEffect(() => {
		if (rejectFetcher.data?.ok) setConfirmReject(null);
	}, [rejectFetcher.data]);
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
		className: "overflow-x-auto",
		children: [/* @__PURE__ */ jsxs("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", {
				className: "border-b border-border text-left",
				children: [
					/* @__PURE__ */ jsx("th", {
						className: "pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider",
						children: "MAC"
					}),
					/* @__PURE__ */ jsx("th", {
						className: "pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider",
						children: "Public Key"
					}),
					/* @__PURE__ */ jsx("th", {
						className: "pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider",
						children: "Received"
					}),
					/* @__PURE__ */ jsx("th", {
						className: "pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider",
						children: "Status"
					}),
					showActions && /* @__PURE__ */ jsx("th", {
						className: "pb-2 text-xs font-semibold text-muted uppercase tracking-wider",
						children: "Actions"
					})
				]
			}) }), /* @__PURE__ */ jsx("tbody", { children: enrollments.map((e) => /* @__PURE__ */ jsxs("tr", {
				className: "border-b border-border/40 hover:bg-elevated/30",
				children: [
					/* @__PURE__ */ jsx("td", {
						className: "py-2 pr-4 font-mono text-xs text-white",
						children: e.mac
					}),
					/* @__PURE__ */ jsxs("td", {
						className: "py-2 pr-4 font-mono text-xs text-muted",
						children: [e.publicKey.slice(0, 8), "…"]
					}),
					/* @__PURE__ */ jsx("td", {
						className: "py-2 pr-4 text-xs text-muted",
						children: (/* @__PURE__ */ new Date(e.receivedAt * 1e3)).toLocaleString()
					}),
					/* @__PURE__ */ jsx("td", {
						className: "py-2 pr-4",
						children: /* @__PURE__ */ jsx(Badge, {
							variant: STATUS_VARIANTS[e.status] ?? "type",
							children: STATUS_LABELS[e.status] ?? "unknown"
						})
					}),
					showActions && e.status === 0 && /* @__PURE__ */ jsx("td", {
						className: "py-2",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ jsx("button", {
								onClick: () => openApprove(e),
								className: "px-2 py-1 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors",
								children: "Approve"
							}), confirmReject === e.mac ? /* @__PURE__ */ jsxs("div", {
								className: "flex gap-1",
								children: [
									/* @__PURE__ */ jsx("button", {
										onClick: () => {
											rejectFetcher.submit(JSON.stringify({ mac: e.mac }), {
												method: "POST",
												action: "/enrollments-reject",
												encType: "application/json"
											});
										},
										className: "px-2 py-1 text-xs bg-danger/20 border border-danger/40 text-danger rounded hover:bg-danger/30",
										children: "Confirm"
									}),
									/* @__PURE__ */ jsx("button", {
										onClick: () => setConfirmReject(null),
										className: "px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white",
										children: "Cancel"
									}),
									rejectFetcher.data?.error && /* @__PURE__ */ jsx("p", {
										className: "text-xs text-danger mt-1",
										children: rejectFetcher.data.error
									})
								]
							}) : /* @__PURE__ */ jsx("button", {
								onClick: () => setConfirmReject(e.mac),
								className: "px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-danger transition-colors",
								children: "Reject"
							})]
						})
					}),
					showActions && e.status !== 0 && /* @__PURE__ */ jsx("td", {})
				]
			}, e.mac)) })]
		}), enrollments.length === 0 && /* @__PURE__ */ jsx("p", {
			className: "text-sm text-muted py-4",
			children: "None."
		})]
	}), /* @__PURE__ */ jsx(SlidePanel, {
		open: approveForm !== null,
		onClose: () => setApproveForm(null),
		title: `Approve: ${approveForm?.mac ?? ""}`,
		children: /* @__PURE__ */ jsxs("form", {
			onSubmit: submitApprove,
			className: "px-4 py-4 space-y-4",
			children: [
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "text-xs text-muted block mb-1",
					children: "Name (optional)"
				}), /* @__PURE__ */ jsx("input", {
					type: "text",
					value: approveForm?.name ?? "",
					onChange: (e) => setApproveForm((f) => f && {
						...f,
						name: e.target.value
					}),
					className: "w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent",
					placeholder: "e.g. entrance-left"
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "text-xs text-muted block mb-1",
					children: "Zone"
				}), /* @__PURE__ */ jsxs("select", {
					value: approveForm?.zone ?? "",
					onChange: (e) => setApproveForm((f) => f && {
						...f,
						zone: e.target.value
					}),
					className: "w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent",
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: "unzoned"
					}), zones.map((z) => /* @__PURE__ */ jsx("option", {
						value: z.id,
						children: z.name
					}, z.id))]
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "text-xs text-muted block mb-1",
					children: "Type"
				}), /* @__PURE__ */ jsx("select", {
					value: approveForm?.type ?? "unknown",
					onChange: (e) => setApproveForm((f) => f && {
						...f,
						type: e.target.value
					}),
					className: "w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent",
					children: DEFAULT_TYPES.map((t) => /* @__PURE__ */ jsx("option", {
						value: t,
						children: t
					}, t))
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					className: "text-xs text-muted block mb-1",
					children: "Node ID (1–255)"
				}), /* @__PURE__ */ jsx("input", {
					type: "number",
					min: 1,
					max: 255,
					value: approveForm?.nodeId ?? "",
					onChange: (e) => setApproveForm((f) => f && {
						...f,
						nodeId: e.target.value
					}),
					className: "w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
				})] }),
				approveFetcher.data?.error && /* @__PURE__ */ jsx("p", {
					className: "text-xs text-danger",
					children: approveFetcher.data.error
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex gap-2 pt-2",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: approveSubmitting,
						className: "flex-1 py-2 text-sm bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors disabled:opacity-50",
						children: approveSubmitting ? "Approving…" : "Approve"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setApproveForm(null),
						className: "flex-1 py-2 text-sm bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
						children: "Cancel"
					})]
				})
			]
		})
	})] });
}
//#endregion
//#region app/routes/enrollments.tsx
var enrollments_exports = /* @__PURE__ */ __exportAll({
	default: () => enrollments_default,
	loader: () => loader$2,
	meta: () => meta$4
});
var meta$4 = () => [{ title: "Enrollments — Lattice Artist Portal" }];
async function loader$2() {
	const [pendingResult, allResult, zonesResult, statusResult] = await Promise.allSettled([
		getPendingEnrollments(),
		getAllEnrollments(),
		getZones(),
		getStatus()
	]);
	return {
		pending: pendingResult.status === "fulfilled" ? pendingResult.value : [],
		all: allResult.status === "fulfilled" ? allResult.value : [],
		zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
		nextFreeId: statusResult.status === "fulfilled" ? statusResult.value.nodes.nextFreeId : 0
	};
}
var enrollments_default = UNSAFE_withComponentProps(function EnrollmentsPage() {
	const { pending, all, zones, nextFreeId } = useLoaderData();
	const [tab, setTab] = useState("pending");
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-4 mb-6",
			children: [/* @__PURE__ */ jsx("h1", {
				className: "text-lg font-semibold",
				children: "Enrollments"
			}), pending.length > 0 && /* @__PURE__ */ jsxs("span", {
				className: "px-2 py-0.5 text-xs bg-warn/20 border border-warn/40 text-warn rounded-full font-medium",
				children: [pending.length, " pending"]
			})]
		}),
		/* @__PURE__ */ jsx("div", {
			className: "flex gap-1 mb-6 bg-surface rounded-lg p-1 w-fit border border-border",
			children: ["pending", "all"].map((t) => /* @__PURE__ */ jsx("button", {
				onClick: () => setTab(t),
				className: `px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? "bg-elevated text-white" : "text-muted hover:text-white"}`,
				children: t === "pending" ? `Pending${pending.length > 0 ? ` (${pending.length})` : ""}` : "All"
			}, t))
		}),
		/* @__PURE__ */ jsx(EnrollmentTable, {
			enrollments: tab === "pending" ? pending : all,
			zones,
			nextFreeId,
			showActions: tab === "pending"
		})
	] });
});
//#endregion
//#region app/routes/nodes-patch.ts
var nodes_patch_exports = /* @__PURE__ */ __exportAll({ action: () => action$1 });
async function action$1({ request }) {
	const body = await request.json();
	try {
		await updateNode(body.id, {
			name: body.name,
			zone: body.zone,
			type: body.type
		});
		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
//#endregion
//#region app/routes/api-docs.tsx
var api_docs_exports = /* @__PURE__ */ __exportAll({
	default: () => api_docs_default,
	meta: () => meta$3
});
var meta$3 = () => [{ title: "API Reference — Lattice Artist Portal" }];
var api_docs_default = UNSAFE_withComponentProps(function ApiDocsPage() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
		className: "text-xl font-semibold mb-6",
		children: "API Reference"
	}), mounted ? /* @__PURE__ */ jsx(SwaggerWrapper, {}) : /* @__PURE__ */ jsx("div", { className: "h-96 bg-surface rounded-lg border border-border animate-pulse" })] });
});
function SwaggerWrapper() {
	const [SwaggerUI, setSwaggerUI] = useState(null);
	useEffect(() => {
		import("swagger-ui-react").then((m) => {
			setSwaggerUI(() => m.default);
		});
	}, []);
	if (!SwaggerUI) return null;
	return /* @__PURE__ */ jsx("div", {
		className: "swagger-wrapper bg-white rounded-lg overflow-hidden",
		children: /* @__PURE__ */ jsx(SwaggerUI, { url: "/openapi/v1.yaml" })
	});
}
//#endregion
//#region app/components/ui/StatusDot.tsx
var colorMap = {
	ok: "bg-ok",
	error: "bg-danger",
	warn: "bg-warn"
};
var sizeMap = {
	sm: "size-2",
	md: "size-3"
};
function StatusDot({ status, size = "md" }) {
	return /* @__PURE__ */ jsx("span", { className: `inline-block rounded-full ${colorMap[status]} ${sizeMap[size]} ${status === "ok" ? "animate-pulse" : ""}` });
}
//#endregion
//#region app/services/api.ts
async function sendNodeCommand(id, action, colour) {
	const res = await fetch("/nodes-command", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			id,
			action,
			colour
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Command failed: ${res.status} ${text}`);
	}
	return res.json();
}
async function sendZoneCommand(id, action, colour) {
	const res = await fetch("/zones-command", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			id,
			action,
			colour
		})
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Zone command failed: ${res.status} ${text}`);
	}
	return res.json();
}
//#endregion
//#region app/components/features/NodeCard.tsx
function formatUptime$1(s) {
	const h = Math.floor(s / 3600);
	const m = Math.floor(s % 3600 / 60);
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatRelative$1(iso) {
	const diff = Date.now() - new Date(iso).getTime();
	const s = Math.floor(diff / 1e3);
	if (s < 60) return `${s}s ago`;
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	return `${Math.floor(s / 86400)}d ago`;
}
function NodeCommands({ node }) {
	const [ledColour, setLedColour] = useState("#ff6400");
	const hexToRgb = (hex) => {
		return [
			parseInt(hex.slice(1, 3), 16),
			parseInt(hex.slice(3, 5), 16),
			parseInt(hex.slice(5, 7), 16)
		];
	};
	if (node.type === "led") return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-wrap gap-2 pt-3 border-t border-border",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-1.5 flex-1",
			children: [/* @__PURE__ */ jsx("input", {
				type: "color",
				value: ledColour,
				onChange: (e) => setLedColour(e.target.value),
				className: "h-7 w-10 rounded cursor-pointer bg-transparent border border-border p-0",
				title: "Pick colour"
			}), /* @__PURE__ */ jsx("button", {
				onClick: () => sendNodeCommand(node.id, "led_solid", hexToRgb(ledColour)),
				className: "px-2 py-1 text-xs bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors",
				children: "On"
			})]
		}), /* @__PURE__ */ jsx("button", {
			onClick: () => sendNodeCommand(node.id, "led_off"),
			className: "px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
			children: "Off"
		})]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "flex gap-2 pt-3 border-t border-border",
		children: [/* @__PURE__ */ jsx("button", {
			onClick: () => sendNodeCommand(node.id, "relay_on"),
			className: "flex-1 px-2 py-1 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors",
			children: "Relay On"
		}), /* @__PURE__ */ jsx("button", {
			onClick: () => sendNodeCommand(node.id, "relay_off"),
			className: "flex-1 px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
			children: "Relay Off"
		})]
	});
}
function NodeCard({ node }) {
	const isOutput = node.type === "led" || node.type === "relay";
	return /* @__PURE__ */ jsxs("div", {
		className: "bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm font-semibold text-white truncate",
						children: node.name || `Node ${node.id}`
					}), /* @__PURE__ */ jsxs("p", {
						className: "text-xs text-muted mt-0.5",
						children: ["ID: ", node.id]
					})]
				}), /* @__PURE__ */ jsx(StatusDot, { status: node.online ? "ok" : "error" })]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap gap-1.5",
				children: [/* @__PURE__ */ jsx(Badge, {
					variant: "zone",
					children: node.zone || "unzoned"
				}), /* @__PURE__ */ jsx(Badge, {
					variant: "type",
					children: node.type
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-y-2 text-xs",
				children: [
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-muted",
						children: "Hops"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-white font-medium",
						children: node.hopCount
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-muted",
						children: "Uptime"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-white font-medium",
						children: formatUptime$1(node.uptime)
					})] }),
					/* @__PURE__ */ jsxs("div", {
						className: "col-span-2",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-muted",
							children: "Last seen"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-white font-medium",
							children: formatRelative$1(node.lastSeen)
						})]
					})
				]
			}),
			isOutput && /* @__PURE__ */ jsx(NodeCommands, { node })
		]
	});
}
//#endregion
//#region app/components/features/EventFeed.tsx
var typeColors = {
	motion: "text-warn",
	health: "text-ok",
	node_online: "text-ok",
	node_offline: "text-danger",
	enrolled: "text-accent",
	command_ack: "text-muted"
};
function formatTime(iso) {
	return new Date(iso).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit"
	});
}
function EventRow({ event }) {
	const color = typeColors[event.type] ?? "text-muted";
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-start gap-3 py-2 border-b border-border/50 text-xs last:border-0",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "text-muted shrink-0 font-mono",
				children: formatTime("timestamp" in event ? event.timestamp : (/* @__PURE__ */ new Date()).toISOString())
			}),
			/* @__PURE__ */ jsx("span", {
				className: `shrink-0 font-medium ${color}`,
				children: event.type
			}),
			"name" in event && /* @__PURE__ */ jsx("span", {
				className: "text-muted truncate",
				children: event.name
			})
		]
	});
}
function EventFeed({ events }) {
	if (!events.length) return /* @__PURE__ */ jsx("p", {
		className: "text-sm text-muted py-4",
		children: "Waiting for events…"
	});
	return /* @__PURE__ */ jsx("div", {
		className: "bg-surface border border-border rounded-lg px-4 divide-y divide-border/50 max-h-80 overflow-y-auto",
		children: events.slice(0, 50).map((e, i) => /* @__PURE__ */ jsx(EventRow, { event: e }, i))
	});
}
//#endregion
//#region app/lib/topology.ts
function buildFlowNodes(nodes, masterOnline) {
	const result = [{
		id: "master",
		type: "meshNode",
		position: {
			x: 0,
			y: 0
		},
		data: {
			label: "Master",
			online: masterOnline,
			isMaster: true,
			node: null
		}
	}];
	for (const node of nodes) result.push({
		id: String(node.id),
		type: "meshNode",
		position: {
			x: 0,
			y: 0
		},
		data: {
			label: node.name !== "" ? node.name : `Node ${node.id}`,
			online: node.online,
			isMaster: false,
			node
		}
	});
	return result;
}
function inferEdges(nodes, masterOnline) {
	const edges = [];
	const nodeById = new Map(nodes.map((n) => [n.id, n]));
	for (const node of nodes) {
		let sourceId;
		if (node.parentId !== void 0 && node.hopCount !== 1) if (nodeById.has(node.parentId)) sourceId = String(node.parentId);
		else sourceId = "master";
		else if (node.hopCount === 1) sourceId = "master";
		else {
			const parents = nodes.filter((p) => p.hopCount === node.hopCount - 1).sort((a, b) => a.name.localeCompare(b.name));
			const parent = parents.filter((p) => p.zone === node.zone)[0] ?? parents[0];
			if (!parent) continue;
			sourceId = String(parent.id);
		}
		const source = sourceId === "master" ? null : nodeById.get(parseInt(sourceId, 10));
		const connected = sourceId === "master" ? masterOnline && node.online : (source?.online ?? false) && node.online;
		edges.push({
			id: `${sourceId}-${node.id}`,
			source: sourceId,
			target: String(node.id),
			style: {
				stroke: connected ? "#ffffff" : "#ef4444",
				strokeWidth: 1.5
			}
		});
	}
	return edges;
}
var NODE_WIDTH = 130;
var NODE_HEIGHT = 60;
function applyDagreLayout(nodes, edges) {
	const g = new dagre.graphlib.Graph();
	g.setDefaultEdgeLabel(() => ({}));
	g.setGraph({
		rankdir: "TB",
		nodesep: 80,
		ranksep: 100
	});
	for (const node of nodes) g.setNode(node.id, {
		width: NODE_WIDTH,
		height: NODE_HEIGHT
	});
	for (const edge of edges) g.setEdge(edge.source, edge.target);
	dagre.layout(g);
	return nodes.map((node) => {
		const pos = g.node(node.id);
		if (!pos) return node;
		return {
			...node,
			position: {
				x: pos.x - NODE_WIDTH / 2,
				y: pos.y - NODE_HEIGHT / 2
			}
		};
	});
}
//#endregion
//#region app/components/features/NodeMapNode.tsx
var bgColor = (data) => {
	if (data.isMaster) return "#14b8a6";
	return data.online ? "#22c55e" : "#ef4444";
};
function NodeMapNode({ data }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "px-3 py-2 rounded-lg border border-white/20 text-xs font-medium text-white text-center min-w-[110px] cursor-pointer select-none shadow-md",
		style: { backgroundColor: bgColor(data) },
		children: [
			/* @__PURE__ */ jsx(Handle, {
				type: "target",
				position: Position.Top,
				style: {
					background: "rgba(255,255,255,0.4)",
					border: "none"
				}
			}),
			/* @__PURE__ */ jsx("div", {
				className: "truncate max-w-[110px]",
				children: data.label
			}),
			!data.isMaster && /* @__PURE__ */ jsx("div", {
				className: "text-white/70 text-[10px] mt-0.5",
				children: data.online ? "online" : "offline"
			}),
			/* @__PURE__ */ jsx(Handle, {
				type: "source",
				position: Position.Bottom,
				style: {
					background: "rgba(255,255,255,0.4)",
					border: "none"
				}
			})
		]
	});
}
//#endregion
//#region app/components/ui/InlineEdit.tsx
function InlineEdit({ value, onSave, disabled, placeholder }) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const inputRef = useRef(null);
	useEffect(() => {
		if (editing) inputRef.current?.focus();
	}, [editing]);
	useEffect(() => {
		if (!editing) setDraft(value);
	}, [value, editing]);
	function commit() {
		if (!editing) return;
		setEditing(false);
		if (draft.trim() !== value) onSave(draft.trim());
	}
	function handleKeyDown(e) {
		if (e.key === "Enter") commit();
		if (e.key === "Escape") {
			setDraft(value);
			setEditing(false);
		}
	}
	if (editing) return /* @__PURE__ */ jsx("input", {
		ref: inputRef,
		value: draft,
		onChange: (e) => setDraft(e.target.value),
		onBlur: commit,
		onKeyDown: handleKeyDown,
		disabled,
		placeholder,
		className: "bg-elevated border border-accent/50 rounded px-2 py-0.5 text-sm text-white w-full focus:outline-none focus:border-accent"
	});
	return /* @__PURE__ */ jsx("button", {
		onClick: () => !disabled && setEditing(true),
		disabled,
		className: "text-sm text-white text-left truncate w-full hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-default",
		children: value || /* @__PURE__ */ jsx("span", {
			className: "text-muted",
			children: placeholder ?? "click to edit"
		})
	});
}
//#endregion
//#region app/components/features/NodeDetailPanel.tsx
var NODE_TYPES$1 = [
	"pir",
	"led",
	"relay",
	"serial",
	"unknown"
];
function formatUptime(s) {
	const d = Math.floor(s / 86400);
	const h = Math.floor(s % 86400 / 3600);
	const m = Math.floor(s % 3600 / 60);
	const parts = [];
	if (d > 0) parts.push(`${d}d`);
	if (h > 0) parts.push(`${h}h`);
	parts.push(`${m}m`);
	return parts.join(" ");
}
function formatRelative(iso) {
	const diff = Date.now() - new Date(iso).getTime();
	const s = Math.floor(diff / 1e3);
	if (s < 60) return `${s}s ago`;
	if (s < 3600) return `${Math.floor(s / 60)}m ago`;
	if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
	return `${Math.floor(s / 86400)}d ago`;
}
function Row({ label, value }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center justify-between py-2 border-b border-border/50 last:border-0",
		children: [/* @__PURE__ */ jsx("span", {
			className: "text-xs text-muted",
			children: label
		}), /* @__PURE__ */ jsx("span", {
			className: "text-sm text-white",
			children: value
		})]
	});
}
function PanelCommands({ node }) {
	const [ledColour, setLedColour] = useState("#ff6400");
	const hexToRgb = (hex) => [
		parseInt(hex.slice(1, 3), 16),
		parseInt(hex.slice(3, 5), 16),
		parseInt(hex.slice(5, 7), 16)
	];
	if (node.type === "led") return /* @__PURE__ */ jsxs("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ jsx("input", {
				type: "color",
				value: ledColour,
				onChange: (e) => setLedColour(e.target.value),
				className: "h-7 w-10 rounded cursor-pointer bg-transparent border border-border p-0"
			}), /* @__PURE__ */ jsx("button", {
				onClick: () => sendNodeCommand(node.id, "led_solid", hexToRgb(ledColour)),
				className: "flex-1 px-3 py-1.5 text-xs bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors",
				children: "LED On"
			})]
		}), /* @__PURE__ */ jsx("button", {
			onClick: () => sendNodeCommand(node.id, "led_off"),
			className: "w-full px-3 py-1.5 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
			children: "LED Off"
		})]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ jsx("button", {
			onClick: () => sendNodeCommand(node.id, "relay_on"),
			className: "w-full px-3 py-1.5 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors",
			children: "Relay On"
		}), /* @__PURE__ */ jsx("button", {
			onClick: () => sendNodeCommand(node.id, "relay_off"),
			className: "w-full px-3 py-1.5 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
			children: "Relay Off"
		})]
	});
}
function NodeDetailPanel({ node, zones, onClose, onEdit }) {
	const editFetcher = useFetcher();
	const deleteFetcher = useFetcher();
	const [confirmDelete, setConfirmDelete] = useState(false);
	useEffect(() => {
		const handler = (e) => {
			if (e.key !== "Escape") return;
			const active = document.activeElement;
			if (active instanceof HTMLInputElement || active instanceof HTMLSelectElement) return;
			onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onClose]);
	useEffect(() => {
		if (editFetcher.data?.ok) onEdit();
	}, [editFetcher.data, onEdit]);
	useEffect(() => {
		if (deleteFetcher.data?.ok) {
			onClose();
			onEdit();
		}
	}, [
		deleteFetcher.data,
		onClose,
		onEdit
	]);
	function patchNode(patch) {
		editFetcher.submit(JSON.stringify({
			id: node.id,
			...patch
		}), {
			method: "POST",
			action: "/nodes-patch",
			encType: "application/json"
		});
	}
	const isOutput = node.type === "led" || node.type === "relay";
	const submitting = editFetcher.state === "submitting";
	const deleting = deleteFetcher.state === "submitting";
	return /* @__PURE__ */ jsxs("div", {
		className: "absolute right-0 top-0 h-full w-72 bg-surface border-l border-border flex flex-col z-10 shadow-2xl",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between px-4 py-3 border-b border-border shrink-0",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "text-sm font-semibold truncate pr-2",
					children: node.name || `Node ${node.id}`
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-2 shrink-0",
					children: [/* @__PURE__ */ jsx("button", {
						onClick: () => setConfirmDelete(true),
						className: "text-muted hover:text-danger transition-colors text-sm leading-none",
						"aria-label": "Delete node",
						title: "Delete node",
						children: "🗑"
					}), /* @__PURE__ */ jsx("button", {
						onClick: onClose,
						className: "text-muted hover:text-white transition-colors text-lg leading-none",
						"aria-label": "Close",
						children: "✕"
					})]
				})]
			}),
			confirmDelete && /* @__PURE__ */ jsxs("div", {
				className: "px-4 py-3 bg-danger/10 border-b border-danger/20 shrink-0",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-xs text-danger mb-2",
						children: "Delete this node?"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							onClick: () => {
								deleteFetcher.submit(JSON.stringify({ id: node.id }), {
									method: "POST",
									action: "/nodes-delete",
									encType: "application/json"
								});
							},
							disabled: deleting,
							className: "flex-1 px-2 py-1 text-xs bg-danger/20 border border-danger/40 text-danger rounded hover:bg-danger/30 transition-colors disabled:opacity-50",
							children: deleting ? "Deleting…" : "Confirm"
						}), /* @__PURE__ */ jsx("button", {
							onClick: () => setConfirmDelete(false),
							className: "flex-1 px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
							children: "Cancel"
						})]
					}),
					deleteFetcher.data?.error && /* @__PURE__ */ jsx("p", {
						className: "text-xs text-danger mt-1",
						children: deleteFetcher.data.error
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex-1 overflow-y-auto px-4 py-2",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between py-2 border-b border-border/50",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-xs text-muted",
							children: "Name"
						}), /* @__PURE__ */ jsx("div", {
							className: "w-36",
							children: /* @__PURE__ */ jsx(InlineEdit, {
								value: node.name || `Node ${node.id}`,
								onSave: (name) => patchNode({ name }),
								disabled: submitting
							})
						})]
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Node ID",
						value: node.id
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between py-2 border-b border-border/50",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-xs text-muted",
							children: "Zone"
						}), /* @__PURE__ */ jsxs("select", {
							value: node.zone || "",
							onChange: (e) => patchNode({ zone: e.target.value }),
							disabled: submitting,
							className: "bg-elevated border border-border rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-accent disabled:opacity-50",
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "unzoned"
							}), zones.map((z) => /* @__PURE__ */ jsx("option", {
								value: z.id,
								children: z.name
							}, z.id))]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between py-2 border-b border-border/50",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-xs text-muted",
							children: "Type"
						}), /* @__PURE__ */ jsx("select", {
							value: node.type,
							onChange: (e) => patchNode({ type: e.target.value }),
							disabled: submitting,
							className: "bg-elevated border border-border rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-accent disabled:opacity-50",
							children: NODE_TYPES$1.map((t) => /* @__PURE__ */ jsx("option", {
								value: t,
								children: t
							}, t))
						})]
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Status",
						value: /* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx(StatusDot, {
								status: node.online ? "ok" : "error",
								size: "sm"
							}), node.online ? "online" : "offline"]
						})
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Hop Count",
						value: node.hopCount
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Uptime",
						value: formatUptime(node.uptime)
					}),
					/* @__PURE__ */ jsx(Row, {
						label: "Last Seen",
						value: formatRelative(node.lastSeen)
					}),
					editFetcher.data?.error && /* @__PURE__ */ jsx("p", {
						className: "text-xs text-danger mt-2",
						children: editFetcher.data.error
					})
				]
			}),
			isOutput && /* @__PURE__ */ jsxs("div", {
				className: "px-4 py-4 border-t border-border shrink-0",
				children: [/* @__PURE__ */ jsx("p", {
					className: "text-[10px] text-muted uppercase tracking-wider mb-3",
					children: "Commands"
				}), /* @__PURE__ */ jsx(PanelCommands, { node })]
			})
		]
	});
}
//#endregion
//#region app/components/features/NodeMap.tsx
var NODE_TYPES = { meshNode: NodeMapNode };
function NodeMap({ nodes, serverOnline, zones, onEdit }) {
	const [mounted, setMounted] = useState(false);
	const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
	const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);
	const [selectedNodeId, setSelectedNodeId] = useState(null);
	const selectedNode = selectedNodeId !== null ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
	useEffect(() => {
		setMounted(true);
	}, []);
	useEffect(() => {
		if (!mounted) return;
		const flowNodes = buildFlowNodes(nodes, serverOnline);
		const edges = inferEdges(nodes, serverOnline);
		const positioned = applyDagreLayout(flowNodes, edges);
		setRfNodes(positioned);
		setRfEdges(edges);
	}, [
		nodes,
		serverOnline,
		mounted,
		setRfNodes,
		setRfEdges
	]);
	useEffect(() => {
		if (selectedNodeId !== null && !nodes.find((n) => n.id === selectedNodeId)) setSelectedNodeId(null);
	}, [nodes, selectedNodeId]);
	const onNodeClick = useCallback((_evt, node) => {
		if (node.data.isMaster) return;
		setSelectedNodeId(node.data.node?.id ?? null);
	}, []);
	const handlePanelClose = useCallback(() => setSelectedNodeId(null), []);
	if (!mounted) return /* @__PURE__ */ jsx("div", { className: "h-[600px] bg-surface rounded-lg border border-border animate-pulse" });
	return /* @__PURE__ */ jsxs("div", {
		className: "relative h-[600px] bg-surface rounded-lg border border-border overflow-hidden",
		children: [/* @__PURE__ */ jsxs(ReactFlow, {
			nodes: rfNodes,
			edges: rfEdges,
			onNodesChange,
			onEdgesChange,
			onNodeClick,
			nodeTypes: NODE_TYPES,
			fitView: true,
			fitViewOptions: { padding: .2 },
			minZoom: .3,
			maxZoom: 2,
			colorMode: "dark",
			children: [/* @__PURE__ */ jsx(Background, {
				color: "#2a3030",
				gap: 20
			}), /* @__PURE__ */ jsx(Controls, { style: {
				background: "#1e2424",
				border: "1px solid #2a3030",
				borderRadius: 8
			} })]
		}), selectedNode && /* @__PURE__ */ jsx(NodeDetailPanel, {
			node: selectedNode,
			zones,
			onClose: handlePanelClose,
			onEdit
		})]
	});
}
//#endregion
//#region app/services/sse.ts
var SSE_NAMES = [
	"motion",
	"health",
	"node_online",
	"node_offline",
	"enrolled",
	"command_ack",
	"route_update"
];
function connectSSE(onEvent, onDisconnect) {
	const es = new EventSource(`http://localhost:8080/api/v1/events`);
	SSE_NAMES.forEach((name) => {
		es.addEventListener(name, (e) => {
			try {
				onEvent({
					type: name,
					...JSON.parse(e.data)
				});
			} catch (err) {
				console.error("[SSE] event parse error", name, err);
			}
		});
	});
	es.onerror = () => {
		onDisconnect();
		es.close();
	};
	return () => es.close();
}
//#endregion
//#region app/hooks/useLiveMesh.ts
var REFRESH_EVENTS = [
	"health",
	"node_online",
	"node_offline",
	"route_update"
];
function useLiveMesh(initialNodes, initialOnline) {
	const [nodes, setNodes] = useState(initialNodes);
	const [events, setEvents] = useState([]);
	const [serverOnline, setServerOnline] = useState(initialOnline);
	const fetcher = useFetcher();
	useEffect(() => {
		if (fetcher.data?.nodes) setNodes(fetcher.data.nodes);
	}, [fetcher.data]);
	const refreshNodes = useCallback(() => {
		fetcher.load("/nodes-refresh");
	}, []);
	useEffect(() => {
		return connectSSE((event) => {
			setServerOnline(true);
			setEvents((prev) => [event, ...prev].slice(0, 200));
			if (REFRESH_EVENTS.includes(event.type)) refreshNodes();
		}, () => setServerOnline(false));
	}, [refreshNodes]);
	return {
		nodes,
		events,
		serverOnline,
		refreshNodes
	};
}
//#endregion
//#region app/routes/_index.tsx
var _index_exports = /* @__PURE__ */ __exportAll({
	default: () => _index_default,
	loader: () => loader$1,
	meta: () => meta$2
});
var meta$2 = () => [{ title: "Live Tracker — Lattice Artist Portal" }];
async function loader$1(_) {
	const [nodesResult, statusResult, zonesResult] = await Promise.allSettled([
		getNodes(),
		getStatus(),
		getZones()
	]);
	return {
		nodes: nodesResult.status === "fulfilled" ? nodesResult.value : [],
		serverOnline: statusResult.status === "fulfilled" ? statusResult.value.mesh.masterOnline : false,
		zones: zonesResult.status === "fulfilled" ? zonesResult.value : []
	};
}
var _index_default = UNSAFE_withComponentProps(function TrackerPage() {
	const { nodes: initialNodes, serverOnline: initialOnline, zones } = useLoaderData();
	const { nodes, events, serverOnline, refreshNodes } = useLiveMesh(initialNodes, initialOnline);
	const [tab, setTab] = useState("list");
	const bannerCls = serverOnline === null ? "bg-surface text-muted border border-border" : serverOnline ? "bg-ok/10 text-ok border border-ok/20" : "bg-danger/10 text-danger border border-danger/20";
	const bannerLabel = serverOnline === null ? "Connecting…" : serverOnline ? "Connected to mesh" : "Disconnected from mesh";
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: `flex items-center gap-2 mb-6 px-4 py-2.5 rounded-lg text-sm font-medium ${bannerCls}`,
			children: [serverOnline !== null && /* @__PURE__ */ jsx(StatusDot, {
				status: serverOnline ? "ok" : "error",
				size: "sm"
			}), bannerLabel]
		}),
		/* @__PURE__ */ jsx("div", {
			className: "flex gap-1 mb-6 bg-surface rounded-lg p-1 w-fit border border-border",
			children: ["list", "map"].map((t) => /* @__PURE__ */ jsx("button", {
				onClick: () => setTab(t),
				className: `px-4 py-1.5 rounded text-sm font-medium transition-colors ${tab === t ? "bg-elevated text-white" : "text-muted hover:text-white"}`,
				children: t === "list" ? "Node List" : "Mesh Map"
			}, t))
		}),
		tab === "list" ? /* @__PURE__ */ jsxs(Fragment, { children: [
			nodes.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "text-sm text-muted mb-8",
				children: "No nodes registered."
			}) : /* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-8",
				children: nodes.map((n) => /* @__PURE__ */ jsx(NodeCard, { node: n }, n.id))
			}),
			/* @__PURE__ */ jsx("h2", {
				className: "text-[10px] font-semibold text-muted uppercase tracking-widest mb-3",
				children: "Event Feed"
			}),
			/* @__PURE__ */ jsx(EventFeed, { events })
		] }) : /* @__PURE__ */ jsx(NodeMap, {
			nodes,
			serverOnline: serverOnline ?? false,
			zones,
			onEdit: refreshNodes
		})
	] });
});
//#endregion
//#region app/routes/guides.tsx
var guides_exports = /* @__PURE__ */ __exportAll({
	default: () => guides_default,
	meta: () => meta$1
});
var meta$1 = () => [{ title: "Integration Guides — Lattice Artist Portal" }];
var GUIDES = [
	{
		title: "Getting Started",
		description: "Connect your first node, enroll it into the mesh, and verify it appears in the Live Tracker.",
		tags: ["quickstart"]
	},
	{
		title: "Controlling LED Nodes",
		description: "Send led_solid and led_off commands via the REST API. Includes colour format reference and rate limits.",
		tags: ["led", "commands"]
	},
	{
		title: "Relay Switching",
		description: "Toggle relay nodes on and off. Covers relay_on, relay_off actions and command acknowledgement flow.",
		tags: ["relay", "commands"]
	},
	{
		title: "Reading Motion Events",
		description: "Subscribe to the SSE event stream to receive real-time motion events from PIR sensors.",
		tags: ["pir", "sse"]
	},
	{
		title: "Node Health & Topology",
		description: "Understand hop counts, health timeouts, and how the mesh routes messages back to the master.",
		tags: ["mesh", "health"]
	},
	{
		title: "Enrollment Flow",
		description: "Walk through how new nodes announce themselves and how to approve or reject enrollments.",
		tags: ["enrollment"]
	}
];
var guides_default = UNSAFE_withComponentProps(function GuidesPage() {
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsx("h1", {
			className: "text-xl font-semibold mb-2",
			children: "Integration Guides"
		}),
		/* @__PURE__ */ jsx("p", {
			className: "text-sm text-muted mb-8",
			children: "Everything you need to build on the Lattice mesh network."
		}),
		/* @__PURE__ */ jsx("div", {
			className: "grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4",
			children: GUIDES.map((g) => /* @__PURE__ */ jsxs("div", {
				className: "bg-surface border border-border rounded-lg p-5",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "text-sm font-semibold text-white mb-2",
						children: g.title
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-xs text-muted leading-relaxed mb-4",
						children: g.description
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-1.5",
						children: g.tags.map((t) => /* @__PURE__ */ jsx("span", {
							className: "px-2 py-0.5 text-[10px] rounded bg-elevated text-muted border border-border",
							children: t
						}, t))
					})
				]
			}, g.title))
		})
	] });
});
//#endregion
//#region app/components/features/ZoneCard.tsx
var MAX_VISIBLE_NAMES = 5;
var hexToRgb = (hex) => [
	parseInt(hex.slice(1, 3), 16),
	parseInt(hex.slice(3, 5), 16),
	parseInt(hex.slice(5, 7), 16)
];
function ZoneCard({ zone, nodes }) {
	const renameFetcher = useFetcher();
	const deleteFetcher = useFetcher();
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [ledColour, setLedColour] = useState("#ff6400");
	const hasOutputNodes = nodes.some((n) => n.type === "led" || n.type === "relay");
	const hasLed = nodes.some((n) => n.type === "led");
	const hasRelay = nodes.some((n) => n.type === "relay");
	const overflow = nodes.length - MAX_VISIBLE_NAMES;
	return /* @__PURE__ */ jsxs("div", {
		className: "bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-2",
				children: [/* @__PURE__ */ jsx("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ jsx(InlineEdit, {
						value: zone.name,
						onSave: (name) => renameFetcher.submit(JSON.stringify({
							id: zone.id,
							name
						}), {
							method: "POST",
							action: "/zones-update",
							encType: "application/json"
						}),
						disabled: renameFetcher.state === "submitting"
					})
				}), /* @__PURE__ */ jsx("button", {
					onClick: () => setConfirmDelete(true),
					title: nodes.length > 0 ? "Move nodes to another zone first" : "Delete zone",
					disabled: nodes.length > 0,
					className: "text-muted hover:text-danger transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0",
					children: "🗑"
				})]
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "text-xs text-muted",
				children: [
					nodes.length,
					" node",
					nodes.length !== 1 ? "s" : ""
				]
			}),
			nodes.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap gap-1",
				children: [nodes.slice(0, MAX_VISIBLE_NAMES).map((n) => /* @__PURE__ */ jsx("span", {
					className: "px-1.5 py-0.5 text-[10px] bg-elevated border border-border rounded text-muted",
					children: n.name || `Node ${n.id}`
				}, n.id)), overflow > 0 && /* @__PURE__ */ jsxs("span", {
					className: "px-1.5 py-0.5 text-[10px] bg-elevated border border-border rounded text-muted",
					children: [
						"+",
						overflow,
						" more"
					]
				})]
			}),
			confirmDelete && /* @__PURE__ */ jsxs("div", {
				className: "bg-danger/10 border border-danger/20 rounded p-2 space-y-2",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "text-xs text-danger",
						children: [
							"Delete zone \"",
							zone.name,
							"\"?"
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							onClick: () => deleteFetcher.submit(JSON.stringify({ id: zone.id }), {
								method: "POST",
								action: "/zones-delete",
								encType: "application/json"
							}),
							disabled: deleteFetcher.state === "submitting",
							className: "flex-1 px-2 py-1 text-xs bg-danger/20 border border-danger/40 text-danger rounded hover:bg-danger/30 disabled:opacity-50",
							children: deleteFetcher.state === "submitting" ? "Deleting…" : "Confirm"
						}), /* @__PURE__ */ jsx("button", {
							onClick: () => setConfirmDelete(false),
							className: "flex-1 px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white",
							children: "Cancel"
						})]
					}),
					deleteFetcher.data?.error && /* @__PURE__ */ jsx("p", {
						className: "text-xs text-danger",
						children: deleteFetcher.data.error
					})
				]
			}),
			renameFetcher.data?.error && /* @__PURE__ */ jsx("p", {
				className: "text-xs text-danger",
				children: renameFetcher.data.error
			}),
			hasOutputNodes && /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap gap-2 pt-3 border-t border-border",
				children: [hasLed && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-1.5",
					children: [/* @__PURE__ */ jsx("input", {
						type: "color",
						value: ledColour,
						onChange: (e) => setLedColour(e.target.value),
						className: "h-7 w-10 rounded cursor-pointer bg-transparent border border-border p-0",
						title: "Pick colour"
					}), /* @__PURE__ */ jsx("button", {
						onClick: () => sendZoneCommand(zone.id, "led_solid", hexToRgb(ledColour)),
						className: "px-2 py-1 text-xs bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors",
						children: "LED On"
					})]
				}), /* @__PURE__ */ jsx("button", {
					onClick: () => sendZoneCommand(zone.id, "led_off"),
					className: "px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
					children: "LED Off"
				})] }), hasRelay && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
					onClick: () => sendZoneCommand(zone.id, "relay_on"),
					className: "px-2 py-1 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors",
					children: "Relay On"
				}), /* @__PURE__ */ jsx("button", {
					onClick: () => sendZoneCommand(zone.id, "relay_off"),
					className: "px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors",
					children: "Relay Off"
				})] })]
			})
		]
	});
}
//#endregion
//#region app/routes/zones.tsx
var zones_exports = /* @__PURE__ */ __exportAll({
	action: () => action,
	default: () => zones_default,
	loader: () => loader,
	meta: () => meta
});
var meta = () => [{ title: "Zones — Lattice Artist Portal" }];
async function loader() {
	const [zonesResult, nodesResult] = await Promise.allSettled([getZones(), getNodes()]);
	return {
		zones: zonesResult.status === "fulfilled" ? zonesResult.value : [],
		nodes: nodesResult.status === "fulfilled" ? nodesResult.value : []
	};
}
async function action({ request }) {
	const body = await request.json();
	try {
		const zone = await createZone(body.name.trim());
		return Response.json({
			ok: true,
			zone
		});
	} catch (e) {
		return Response.json({
			ok: false,
			error: String(e)
		}, { status: 400 });
	}
}
var zones_default = UNSAFE_withComponentProps(function ZonesPage() {
	const { zones, nodes } = useLoaderData();
	const createFetcher = useFetcher();
	const [newName, setNewName] = useState("");
	const nodesByZone = (zoneId) => nodes.filter((n) => n.zone === zoneId);
	function submitCreate(e) {
		e.preventDefault();
		if (!newName.trim()) return;
		createFetcher.submit(JSON.stringify({ name: newName.trim() }), {
			method: "POST",
			action: "/zones",
			encType: "application/json"
		});
		setNewName("");
	}
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between mb-6",
			children: [/* @__PURE__ */ jsx("h1", {
				className: "text-lg font-semibold",
				children: "Zones"
			}), /* @__PURE__ */ jsxs("span", {
				className: "text-sm text-muted",
				children: [
					zones.length,
					" zone",
					zones.length !== 1 ? "s" : ""
				]
			})]
		}),
		/* @__PURE__ */ jsxs("form", {
			onSubmit: submitCreate,
			className: "flex gap-2 mb-6",
			children: [/* @__PURE__ */ jsx("input", {
				type: "text",
				value: newName,
				onChange: (e) => setNewName(e.target.value),
				placeholder: "New zone name",
				className: "flex-1 bg-surface border border-border rounded px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
			}), /* @__PURE__ */ jsx("button", {
				type: "submit",
				disabled: !newName.trim() || createFetcher.state === "submitting",
				className: "px-4 py-1.5 text-sm bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors disabled:opacity-50",
				children: createFetcher.state === "submitting" ? "Creating…" : "Create"
			})]
		}),
		createFetcher.data?.error && /* @__PURE__ */ jsx("p", {
			className: "text-sm text-danger mb-4",
			children: createFetcher.data.error
		}),
		zones.length === 0 ? /* @__PURE__ */ jsx("p", {
			className: "text-sm text-muted",
			children: "No zones yet."
		}) : /* @__PURE__ */ jsx("div", {
			className: "grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4",
			children: zones.map((zone) => /* @__PURE__ */ jsx(ZoneCard, {
				zone,
				nodes: nodesByZone(zone.id)
			}, zone.id))
		})
	] });
});
//#endregion
//#region \0virtual:react-router/server-manifest
var server_manifest_default = {
	"entry": {
		"module": "/assets/entry.client-BkSq-r0T.js",
		"imports": ["/assets/jsx-runtime-D-yHsK5r.js", "/assets/react-dom-Ya-B8aiR.js"],
		"css": []
	},
	"routes": {
		"root": {
			"id": "root",
			"parentId": void 0,
			"path": "",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/root-ClPTd2zh.js",
			"imports": ["/assets/jsx-runtime-D-yHsK5r.js", "/assets/react-dom-Ya-B8aiR.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/enrollments-approve": {
			"id": "routes/enrollments-approve",
			"parentId": "root",
			"path": "enrollments-approve",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/enrollments-approve-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/enrollments-reject": {
			"id": "routes/enrollments-reject",
			"parentId": "root",
			"path": "enrollments-reject",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/enrollments-reject-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/nodes-command": {
			"id": "routes/nodes-command",
			"parentId": "root",
			"path": "nodes-command",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/nodes-command-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/nodes-refresh": {
			"id": "routes/nodes-refresh",
			"parentId": "root",
			"path": "nodes-refresh",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/nodes-refresh-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/zones-command": {
			"id": "routes/zones-command",
			"parentId": "root",
			"path": "zones-command",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/zones-command-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/nodes-delete": {
			"id": "routes/nodes-delete",
			"parentId": "root",
			"path": "nodes-delete",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/nodes-delete-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/zones-delete": {
			"id": "routes/zones-delete",
			"parentId": "root",
			"path": "zones-delete",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/zones-delete-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/zones-update": {
			"id": "routes/zones-update",
			"parentId": "root",
			"path": "zones-update",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/zones-update-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/enrollments": {
			"id": "routes/enrollments",
			"parentId": "root",
			"path": "enrollments",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/enrollments-DCGHIqdP.js",
			"imports": ["/assets/jsx-runtime-D-yHsK5r.js", "/assets/Badge-DQWUhaL_.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/nodes-patch": {
			"id": "routes/nodes-patch",
			"parentId": "root",
			"path": "nodes-patch",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": false,
			"hasErrorBoundary": false,
			"module": "/assets/nodes-patch-BvRk9kiK.js",
			"imports": [],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/api-docs": {
			"id": "routes/api-docs",
			"parentId": "root",
			"path": "api-docs",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/api-docs-rCZP9Ga2.js",
			"imports": ["/assets/jsx-runtime-D-yHsK5r.js"],
			"css": ["/assets/api-docs-CrIa5r46.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/_index": {
			"id": "routes/_index",
			"parentId": "root",
			"path": void 0,
			"index": true,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/_index-yTDGOnei.js",
			"imports": [
				"/assets/jsx-runtime-D-yHsK5r.js",
				"/assets/react-dom-Ya-B8aiR.js",
				"/assets/Badge-DQWUhaL_.js",
				"/assets/InlineEdit-BRI_Hi2l.js"
			],
			"css": ["/assets/_index-DLioOiRN.css"],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/guides": {
			"id": "routes/guides",
			"parentId": "root",
			"path": "guides",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": false,
			"hasLoader": false,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/guides-8zjbdjwv.js",
			"imports": ["/assets/jsx-runtime-D-yHsK5r.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		},
		"routes/zones": {
			"id": "routes/zones",
			"parentId": "root",
			"path": "zones",
			"index": void 0,
			"caseSensitive": void 0,
			"hasAction": true,
			"hasLoader": true,
			"hasClientAction": false,
			"hasClientLoader": false,
			"hasClientMiddleware": false,
			"hasDefaultExport": true,
			"hasErrorBoundary": false,
			"module": "/assets/zones-B5ZgZLRL.js",
			"imports": ["/assets/jsx-runtime-D-yHsK5r.js", "/assets/InlineEdit-BRI_Hi2l.js"],
			"css": [],
			"clientActionModule": void 0,
			"clientLoaderModule": void 0,
			"clientMiddlewareModule": void 0,
			"hydrateFallbackModule": void 0
		}
	},
	"url": "/assets/manifest-e72fa57b.js",
	"version": "e72fa57b",
	"sri": void 0
};
//#endregion
//#region \0virtual:react-router/server-build
var assetsBuildDirectory = "build/client";
var basename = "/";
var future = {
	"unstable_optimizeDeps": false,
	"v8_passThroughRequests": false,
	"v8_trailingSlashAwareDataRequests": false,
	"unstable_previewServerPrerendering": false,
	"v8_middleware": false,
	"v8_splitRouteModules": false,
	"v8_viteEnvironmentApi": false
};
var ssr = true;
var isSpaMode = false;
var prerender = [];
var routeDiscovery = {
	"mode": "lazy",
	"manifestPath": "/__manifest"
};
var publicPath = "/";
var entry = { module: entry_server_node_exports };
var routes = {
	"root": {
		id: "root",
		parentId: void 0,
		path: "",
		index: void 0,
		caseSensitive: void 0,
		module: root_exports
	},
	"routes/enrollments-approve": {
		id: "routes/enrollments-approve",
		parentId: "root",
		path: "enrollments-approve",
		index: void 0,
		caseSensitive: void 0,
		module: enrollments_approve_exports
	},
	"routes/enrollments-reject": {
		id: "routes/enrollments-reject",
		parentId: "root",
		path: "enrollments-reject",
		index: void 0,
		caseSensitive: void 0,
		module: enrollments_reject_exports
	},
	"routes/nodes-command": {
		id: "routes/nodes-command",
		parentId: "root",
		path: "nodes-command",
		index: void 0,
		caseSensitive: void 0,
		module: nodes_command_exports
	},
	"routes/nodes-refresh": {
		id: "routes/nodes-refresh",
		parentId: "root",
		path: "nodes-refresh",
		index: void 0,
		caseSensitive: void 0,
		module: nodes_refresh_exports
	},
	"routes/zones-command": {
		id: "routes/zones-command",
		parentId: "root",
		path: "zones-command",
		index: void 0,
		caseSensitive: void 0,
		module: zones_command_exports
	},
	"routes/nodes-delete": {
		id: "routes/nodes-delete",
		parentId: "root",
		path: "nodes-delete",
		index: void 0,
		caseSensitive: void 0,
		module: nodes_delete_exports
	},
	"routes/zones-delete": {
		id: "routes/zones-delete",
		parentId: "root",
		path: "zones-delete",
		index: void 0,
		caseSensitive: void 0,
		module: zones_delete_exports
	},
	"routes/zones-update": {
		id: "routes/zones-update",
		parentId: "root",
		path: "zones-update",
		index: void 0,
		caseSensitive: void 0,
		module: zones_update_exports
	},
	"routes/enrollments": {
		id: "routes/enrollments",
		parentId: "root",
		path: "enrollments",
		index: void 0,
		caseSensitive: void 0,
		module: enrollments_exports
	},
	"routes/nodes-patch": {
		id: "routes/nodes-patch",
		parentId: "root",
		path: "nodes-patch",
		index: void 0,
		caseSensitive: void 0,
		module: nodes_patch_exports
	},
	"routes/api-docs": {
		id: "routes/api-docs",
		parentId: "root",
		path: "api-docs",
		index: void 0,
		caseSensitive: void 0,
		module: api_docs_exports
	},
	"routes/_index": {
		id: "routes/_index",
		parentId: "root",
		path: void 0,
		index: true,
		caseSensitive: void 0,
		module: _index_exports
	},
	"routes/guides": {
		id: "routes/guides",
		parentId: "root",
		path: "guides",
		index: void 0,
		caseSensitive: void 0,
		module: guides_exports
	},
	"routes/zones": {
		id: "routes/zones",
		parentId: "root",
		path: "zones",
		index: void 0,
		caseSensitive: void 0,
		module: zones_exports
	}
};
var allowedActionOrigins = false;
//#endregion
export { allowedActionOrigins, server_manifest_default as assets, assetsBuildDirectory, basename, entry, future, isSpaMode, prerender, publicPath, routeDiscovery, routes, ssr };
