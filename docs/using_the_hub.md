# Using the Lattice Hub

This is a plain-language guide to the two web apps that ship with the Lattice
Hub: the **Dashboard** (operations/admin console) and the **Artist Portal**
(day-to-day mesh control and reference for whoever is running the
installation). It describes what you see and what you can click — not how
either app is built. If you're looking for API endpoints or request/response
shapes, see the OpenAPI reference instead; the Artist Portal's "API
Reference" page (described below) is the friendliest way to browse that.

Both apps talk to the same orchestrator (the "hub" or "mesh server") behind
the scenes, but they're separate web pages with separate URLs, and they
serve different audiences:

- **Dashboard** — infrastructure-facing: containers, the mesh server
  process, raw event log, and enrollment approvals. Requires signing in.
- **Artist Portal** — installation-facing: a live map/list of nodes, zone
  grouping, sending commands to lights and relays, and enrollment
  approvals with more fields. No sign-in screen of its own — whoever
  deploys it configures its access to the hub ahead of time.

---

## The Dashboard

### Signing in

Open the Dashboard and you'll land on a sign-in screen with a single field,
"Admin Key." Enter the admin key you configured during setup and select
"Sign in." An incorrect key redisplays the form with "Invalid admin key"
underneath the field. Once you're in, the hub remembers you via a browser
cookie, so you won't have to re-enter the key on every page — only when the
session expires or you explicitly sign out (a "Sign out" button lives at the
bottom of the left-hand navigation sidebar, below the "Infra" section).

The sidebar itself is organized into two groups:

- **Mesh** — Overview, Nodes, Enrollments, Server
- **Infra** — Infrastructure, Events

### Overview

The landing page after sign-in. It shows:

- A summary banner at the top reading something like "5/5 services
  healthy" (green) or "3/5 services healthy — 2 unhealthy" (red) if
  anything is degraded.
- A grid of cards, one per backend service (the orchestrator, sidecar,
  Kafka, and so on), each with a colored status dot, the service name, its
  container state as a small badge, and — where applicable — its last HTTP
  check result and response time, plus when it was last checked.
- Three quick-stat tiles underneath: active node count, pending
  enrollment count, and Kafka partition count.

This page quietly refreshes itself every 30 seconds, so the numbers and
colors stay current without you needing to reload.

### Nodes

Lists every node the hub knows about as a grid of cards. Each card shows
the node's name, a colored status dot, its numeric ID, zone, adapter type
(motion sensor, LED, relay, etc.), uptime, hop count (how many hops of
mesh routing separate it from the hub), and when it was last heard from.
Clicking a card opens that node's detail page, which shows the same
fields in a longer list plus an explicit "Online: Yes/No" line and a
breadcrumb back to the Nodes list.

### Enrollments

This is where new nodes waiting to join the mesh show up. The page is a
table with columns for MAC address, a shortened public key, status
("Pending," "Approved," or "Rejected"), and when the request was received.
Only pending rows get action buttons:

- **Approve** opens a small dialog asking for a **Name** (required) and
  an optional **Zone**. Confirming submits the approval; the dialog
  closes and the table refreshes with the node now marked "Approved."
- **Reject** submits immediately — there's no confirmation dialog on this
  button, so double-check the row before clicking it.

Note that the Dashboard's approval dialog is intentionally minimal — it
doesn't let you pick the node's adapter type or its numeric ID (the hub
assigns the next free ID automatically). If you need those extra fields,
use the Artist Portal's Enrollments page instead (see below).

### Infrastructure

A table of the project's Docker containers — name, image, state (e.g.
"running," "exited"), a human status string, and per-row "Detail" and
"Restart" links. Restarting asks for confirmation first ("Restart
\<name\>?") before it acts. Below the container table is a small Kafka
panel showing whether the broker is reachable, its address, and its
partition count. The whole page refreshes itself every 15 seconds.

Clicking "Detail" on a container opens a page with three tabs:

- **Overview** — image, creation time, restart policy, health string,
  published ports, mounted volumes, and environment variables (values
  the hub considers sensitive are shown as "[redacted]").
- **Stats** — live CPU and memory usage bars while you have the tab open.
- **Logs** — a scrollback viewer. You can choose how many lines to show
  (100/500/1000 via the "Tail" buttons), hit "Refresh" for a one-off
  update, or check "Live" to have it re-poll automatically every few
  seconds.

### Events

A reverse-chronological list of raw messages from the hub's Kafka topic
(labeled "motion-trigger" in the page header). Each row shows an offset
number, a timestamp, and a one-line preview of the message; clicking a
row expands it to show the full message body. A control in the top right
lets you choose how many recent events to load — 50, 100, or 250.

### Server

Distinct from the Infrastructure page: this controls the mesh server
**process** itself (the software that talks to nodes over the serial
connection), not the Docker container it runs in — restarting the
container is done from Infrastructure instead. The page shows:

- Whether the mesh master is online, plus which serial ports are
  configured as primary and secondary.
- A live node count broken down as total / online / offline.
- **Start** and **Stop** buttons to control the mesh server process. Both
  buttons disable themselves and show "Processing…" while a request is
  in flight.

---

## The Artist Portal

There's no sign-in screen here — the portal is configured ahead of time
with whatever access it needs to talk to the hub, so anyone who can reach
the page can use it. The top navigation bar has five links: **Live
Tracker**, **Zones**, **Enrollments**, **API Reference**, and
**Integration Guides**.

### Live Tracker (home page)

At the top, a connection banner tells you whether the portal currently has
a live connection to the mesh: gray "Connecting…" while it first loads,
green "Connected to mesh" once data is flowing, or red "Disconnected from
mesh" if that connection drops. While connected, the page updates itself
automatically as things happen on the mesh — you don't need to refresh
the browser to see a node go offline or a new motion event arrive.

Below the banner is a two-way toggle:

- **Node List** — the default view. A card per node showing its name,
  numeric ID, a colored status dot, zone and type badges, hop count,
  uptime, and how long ago it was last seen. Cards for LED or relay
  nodes get quick-command buttons directly on the card (see "Node
  commands" below). Underneath the cards is a scrolling **Event Feed** —
  a live log of everything happening on the mesh (motion triggers,
  nodes going online/offline, health reports, new enrollments, and
  command acknowledgements), each with a timestamp and color-coded by
  type.
- **Mesh Map** — a visual, auto-arranged diagram of the mesh (see next
  section).

### Mesh Map

A drag/zoom/pan diagram of the whole mesh, arranged top-to-bottom
automatically — you don't position anything by hand. A single teal box at
the top represents the hub itself ("Master"); every node appears below
it as its own box, colored green if online or red if offline, labeled
with its name and online/offline status. Lines connect each node to
whichever node or the master it's routing through, and those lines are
drawn white when both ends are online and reachable, or red when the
connection is currently broken. You can pan by dragging the empty
background, zoom with the on-screen +/- controls or your mouse/trackpad,
and the map fits itself to the window when it first loads.

Clicking any node (not the master box) opens a detail panel on the
right-hand side with:

- **Name** — click it to edit in place; press Enter or click elsewhere to
  save, Escape to cancel.
- **Node ID** (read-only), **Zone** (dropdown, including "unzoned"), and
  **Type** (dropdown: motion sensor, LED, relay, serial, or unknown) —
  changing either dropdown saves immediately.
- **Status**, **Hop Count**, **Uptime**, and **Last Seen**.
- A trash-can icon to delete the node, which asks for confirmation
  ("Delete this node?") before it acts.
- If the node is an LED or relay, a **Commands** section at the bottom
  (see below).

Press Escape (when not focused in a text field or dropdown) or click the
✕ to close the panel.

### Node commands

Nodes of type "LED" or "relay" can be sent live commands from either the
Node List cards or the Mesh Map detail panel:

- **LED nodes** get a color picker plus an "On" button (sets the LED to
  the picked color) and an "Off" button.
- **Relay nodes** get "Relay On" and "Relay Off" buttons.

Motion-sensor ("PIR"), serial, and unknown-type nodes don't get command
buttons — they're inputs to the mesh, not things you switch on or off.

### Zones

Lists every configured zone as a card, each showing how many nodes belong
to it (with up to five node names listed, and a "+N more" tag beyond
that). At the top, a text field plus "Create" button adds a new zone. A
zone's name can be edited in place the same way a node's name can (click
to edit, Enter to save). Deleting a zone is only allowed once it has no
nodes left in it — the trash-can icon is disabled and its tooltip
explains "Move nodes to another zone first" until you do.

If a zone contains any LED or relay nodes, the card also grows a
Commands row at the bottom — the same LED color/on/off and relay on/off
buttons described above, but sent to every matching node in the zone at
once.

### Enrollments

Two tabs: **Pending** (nodes waiting for a decision, with a count badge
next to the tab) and **All** (the full history, including already
approved and rejected requests). The table shows MAC address, a
shortened public key, when the request arrived, and status.

Pending rows get "Approve" and "Reject" buttons:

- **Approve** slides in a panel with more fields than the Dashboard's
  version: an optional **Name**, a **Zone** dropdown, a **Type** dropdown
  (motion sensor, LED, relay, or unknown), and a **Node ID** field
  (1–255), pre-filled with the next free ID but editable. If you type in
  an ID that's already assigned to a different node, approving this
  enrollment hands that ID over to the new node and retires the old one
  — useful when you're physically swapping in a replacement device and
  want it to take over its predecessor's identity instead of registering
  as a brand-new node.
- **Reject** shows an inline "Confirm / Cancel" step before it actually
  rejects — unlike the Dashboard, nothing happens until you confirm.

### API Reference

An embedded, interactive API browser (Swagger UI) for the hub's REST API,
pre-loaded with the current OpenAPI spec. Use this page directly if you
need to see or try out individual endpoints — it isn't duplicated
anywhere else in this guide.

### Integration Guides

A set of reference cards summarizing topics you might want to read up on
— Getting Started, Controlling LED Nodes, Relay Switching, Reading
Motion Events, Node Health & Topology, and the Enrollment Flow — each
with a short description and a few topic tags. As of this writing these
are summary cards rather than full click-through articles; treat them as
an index of what's worth learning next rather than a page with more
detail behind each card.

---

## Status and health indicators, explained

Both apps use color to mean "is this thing okay," but the exact shade of
"okay" — and how quickly it updates — differs by page. Here's what each
one actually means.

### Node online/offline

- **Artist Portal** (Node List cards, Mesh Map, and the node detail
  panel) shows a simple two-state light: green and pulsing for online,
  solid red for offline. This comes straight from the hub's own
  determination of whether the node is online.
- **Dashboard** node cards and the Nodes list use a colored dot with
  three shades based on how long it's been since the node last reported
  in, computed right there in your browser: green if under a minute,
  yellow if under five minutes, red beyond that. The node detail page
  additionally shows a plain "Online: Yes/No" line, which — like the
  Artist Portal's dot — reflects the hub's own determination rather than
  the browser-side timer, so the two can occasionally disagree for a few
  seconds around the boundary.

The hub's own online/offline determination (the one behind the Artist
Portal's dot and the Dashboard's "Online" field) is based on a roughly
75-second health timeout — about 2.5× the normal 30-second reporting
interval, so a single missed report doesn't flip a node to "offline."
See [wire_protocol.md](wire_protocol.md) for the full derivation of that
number if you want the underlying detail.

### Mesh master / connection status

- The Dashboard's **Server** page shows "Master online"/"Master offline"
  as its own status dot, reflecting whether the hub's mesh server process
  currently considers itself connected to the mesh.
- The Artist Portal's connection banner (top of the Live Tracker page)
  is a related but distinct signal: it reflects whether the portal
  itself currently has a live connection to the hub, not the mesh
  hardware directly. It reads "Connecting…" (gray) briefly on page load,
  "Connected to mesh" (green) once live updates are flowing, and
  "Disconnected from mesh" (red) if that connection is lost — in which
  case the page stops receiving live updates, and you'll need to reload
  it to resume them.

### Service and container health (Dashboard only)

On the Overview and Infrastructure pages, each backend service or
container gets a status dot and/or badge derived from a few checks in
order: red ("error") if the container isn't running, or if its own
Docker health check reports "unhealthy," or if its last HTTP check
returned a server error; yellow ("warn") if it's still starting up, or
its last HTTP check returned a client error; green ("ok") if it's
running cleanly; gray ("unknown") if none of the above apply. Container
state badges follow similar logic: green for "running," red for "exited"
or "dead," yellow for "paused" or "restarting," and gray for anything
else.
