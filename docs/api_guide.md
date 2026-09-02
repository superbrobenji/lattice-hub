# The Lattice API in Plain English

Lattice runs your installation's sensors and lights (called **nodes**) as a small
network. Software talks to that network through the **API** — a set of web
addresses your computer can visit or send a short note to, the same way a
browser visits a web page. This guide explains what each of those addresses
does, in plain language, for anyone who wants to understand or poke at the
system without being a programmer.

If you're a developer wiring up code against this API, you want
[`server/orchestrator/examples/api_examples.md`](../server/orchestrator/examples/api_examples.md)
instead — it's the terse, copy-paste reference with every request shown as raw
`curl` and JSON. This guide is the walkthrough: what each address is *for*,
what the reply actually *tells you*, and when you'd bother visiting it. It
only covers the addresses a non-technical reader is likely to care about —
checking on the system, seeing your devices, controlling them, letting new
devices join, and watching things happen live. It skips older, internal, and
one-off addresses that only exist for backwards compatibility.

## Before you start

Every address below is a path added on to your server's location. If your
Lattice server lives at `http://your-server:8080`, then "visit
`/api/v1/status`" means "visit `http://your-server:8080/api/v1/status`".

Some addresses are open to anyone who can reach the server — they only ever
*show* you information, so there's no key needed. Others let you *change*
something (rename a device, send it a command, let a new device join), and
those require a key, sent along with the request like a password:

- **API key** — needed for anything that changes device settings or sends
  commands.
- **Admin key** — needed for the most sensitive actions: approving or
  rejecting a new device, and permanently removing a device. If no separate
  admin key has been set up, the API key works for these too.

Every reply comes back as a small block of structured text (JSON) with a
`success` field that's `true` or `false`, so you (or whatever software you're
using) can tell at a glance whether the request worked. When something goes
wrong, `success` is `false` and an `error` field explains why in a short
sentence.

---

## 1. Checking whether everything is running

**Visit:** `GET /api/v1/status` — no key needed.

This is the "is it working?" check. It tells you whether the server's radio
connections are up, how many devices it knows about and how many of those
are currently reachable, whether the mesh's master device is online, and
whether event history is being saved.

```bash
curl http://your-server:8080/api/v1/status
```

```json
{
  "success": true,
  "data": {
    "serial": { "primary": "connected", "secondary": "not_configured" },
    "nodes": { "total": 5, "online": 4, "offline": 1, "nextFreeId": 6 },
    "mesh": { "masterOnline": true, "primaryOnline": true, "secondaryOnline": false },
    "kafka": {
      "connected": true,
      "topicsReady": true,
      "topics": {
        "motion-trigger":  { "ready": true, "failedWrites": 0, "lastError": "", "lastFailureAt": null },
        "mesh-enrollment": { "ready": true, "failedWrites": 0, "lastError": "", "lastFailureAt": null },
        "mesh-messages":   { "ready": true, "failedWrites": 0, "lastError": "", "lastFailureAt": null }
      },
      "failedWrites": 0,
      "lastError": "",
      "lastFailureAt": null
    }
  }
}
```

In plain terms: the server's primary radio link is connected, there's no
backup link configured, 5 devices are registered and 4 of them are currently
checking in, and the mesh's master device is online. `nextFreeId` is just the
next ID number a newly-joining device would be given — useful mainly for
software, not something you need to act on.

The `mesh` block has three flags. `primaryOnline` and `secondaryOnline` say
whether each master has been heard from on its own serial link within the
last 75 seconds; `secondaryOnline` is always `false` unless dual-master mode
is enabled (`DUAL_MASTER_ENABLED=true` with `SERIAL_PORT_SECONDARY` set).
`masterOnline` is the one-glance answer — `true` if *any* configured master
is online — so in a dual-master setup it stays `true` while one master is
down and the other is still serving.

`kafka` tells you whether event history is being saved. `connected` means the
server reached its message broker when it started, and `topicsReady` means the
three history streams (`motion-trigger`, `mesh-enrollment`, `mesh-messages`)
exist — the server creates them itself and keeps retrying until they do.
`failedWrites` counts events that could not be saved since the server started;
`lastError` and `lastFailureAt` say what went wrong last and when, and each
stream repeats the same fields under `topics`. If `connected` is `false` or
`failedWrites` keeps climbing, live updates still work but the history pages
will have gaps.

**Use this when:** you want a quick "is the installation healthy right now?"
answer before digging into individual devices.

---

## 2. Seeing what devices you have

**Visit:** `GET /api/v1/nodes` — no key needed. Lists every device.

```bash
curl http://your-server:8080/api/v1/nodes
```

```json
{
  "success": true,
  "data": [
    {
      "id": 3,
      "name": "entrance-left",
      "zone": "lobby",
      "type": "pir",
      "online": true,
      "hopCount": 1,
      "uptime": 3600,
      "lastSeen": "2026-08-10T12:00:00Z"
    },
    {
      "id": 4,
      "name": "entrance-led",
      "zone": "lobby",
      "type": "led",
      "online": true,
      "hopCount": 2,
      "uptime": 3550,
      "lastSeen": "2026-08-10T12:00:03Z",
      "parentId": 3
    }
  ]
}
```

Each device in the list tells you: its ID number and the friendly `name`
someone gave it, which `zone` (area) it's assigned to, its `type` (`pir` is a
motion sensor, `led` is a light, `relay` switches something on or off), and
whether it's currently `online`. `uptime` is how many seconds it's been
running since it last powered on, `hopCount` is how many other devices its
signal has to pass through to reach the server (1 means it talks straight to
the master device), and `lastSeen` is the last time it checked in. If a
device relays through another one, `parentId` names that device; devices that
talk directly to the master device don't have this field at all.

**Visit:** `GET /api/v1/nodes/{id}` — no key needed. Same information for one
device — swap `{id}` for the device's ID number.

```bash
curl http://your-server:8080/api/v1/nodes/4
```

```json
{
  "success": true,
  "data": {
    "id": 4,
    "name": "entrance-led",
    "zone": "lobby",
    "type": "led",
    "online": true,
    "hopCount": 2,
    "uptime": 3550,
    "lastSeen": "2026-08-10T12:00:03Z",
    "parentId": 3
  }
}
```

**Use this when:** you want a snapshot of what's out there — how many
devices, where they are, and whether they're currently checking in — or you
want to double-check the details for just one device before naming it in a
command.

---

## 3. Renaming or moving a device

**Visit:** `PATCH /api/v1/nodes/{id}` — needs the API key.

Once a device exists, you can update its friendly name, which zone it
belongs to, or its type (`pir`, `led`, or `relay`), without touching the
physical hardware. You only need to send the fields you want to change.

```bash
curl -X PATCH http://your-server:8080/api/v1/nodes/3 \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "entrance-right", "zone": "lobby"}'
```

```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "entrance-right",
    "zone": "lobby",
    "type": "pir",
    "online": true,
    "hopCount": 1,
    "uptime": 3600,
    "lastSeen": "2026-08-10T12:00:00Z"
  }
}
```

The reply echoes back the device's full, now-updated record so you can
confirm the change took. If you send a `type` the server doesn't recognize,
it rejects the whole request and tells you which value was invalid, rather
than applying a partial change.

**Use this when:** a device gets physically moved to a different area, or you
just want a more descriptive name than the factory default.

---

## 4. Telling a device what to do

**Visit:** `POST /api/v1/nodes/{id}/command` — needs the API key. Only works
on devices that can *act* on something — lights and relays, not motion
sensors.

You send a short instruction naming an `action`:

- `led_solid` — turn a light a solid colour. Needs a `colour` as three
  numbers from 0–255 for red, green, and blue.
- `led_off` — turn a light off.
- `relay_on` / `relay_off` — switch a relay on or off.

```bash
curl -X POST http://your-server:8080/api/v1/nodes/4/command \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "led_solid", "colour": [255, 0, 0]}'
```

```json
{
  "success": true,
  "data": { "commandId": "a1b2c3d4-5678-90ab-cdef-1234567890ab" }
}
```

This reply doesn't mean the light has actually turned red yet — it means the
instruction was accepted and handed to the device. It comes back with a
`commandId` you can use to check whether the device actually received and
carried it out. If you point this at a motion sensor instead of a light or
relay, the server refuses the request outright, since sensors have nothing
to "do."

**Visit:** `GET /api/v1/nodes/{id}/command/{commandId}` — needs the API key.
Checks whether a command you sent was actually carried out.

```bash
curl http://your-server:8080/api/v1/nodes/4/command/a1b2c3d4-5678-90ab-cdef-1234567890ab \
  -H "Authorization: Bearer $API_KEY"
```

```json
{
  "success": true,
  "data": {
    "commandId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "nodeId": 4,
    "action": "led_solid",
    "status": "pending",
    "sentAt": 1754899200
  }
}
```

`status` starts as `"pending"` and flips to `"acked"` once the device
confirms it — at which point the reply also includes an `ackedAt` timestamp.

**Use this when:** you're driving lights or relays as part of a show or
display, and want to confirm a device actually responded rather than assuming
it did.

---

## 5. Removing a device for good

**Visit:** `DELETE /api/v1/nodes/{id}` — needs the admin key. This is
permanent: the device is dropped from the registry and would need to enroll
again (see below) to rejoin.

```bash
curl -X DELETE http://your-server:8080/api/v1/nodes/3 \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "success": true, "message": "node removed" }
```

**Use this when:** a device has been retired, replaced, or was set up by
mistake and you want it gone from the list entirely — not just offline.

---

## 6. Letting new devices join

New hardware doesn't just start controlling things the moment it's powered
on — it first has to be approved, so a stray or unfamiliar device can't join
your installation. These addresses cover that approval process.

**Visit:** `GET /api/v1/enrollments/pending` — needs the API key. Lists
devices that are waiting for a decision.

```bash
curl http://your-server:8080/api/v1/enrollments/pending \
  -H "Authorization: Bearer $API_KEY"
```

```json
{
  "success": true,
  "data": [
    {
      "mac": "aa:bb:cc:dd:ee:ff",
      "publicKey": "3f8a1c2d9b...",
      "status": 0,
      "receivedAt": 1754899200,
      "approvedAt": -62135596800
    }
  ]
}
```

`mac` is the device's built-in hardware serial number — it's how you tell
devices apart before they've been given a friendly name. `publicKey` is a
cryptographic identifier baked into the device that lets the server verify
it's really talking to that device later on; you never need to type it
anywhere yourself. `status` is a number: `0` means still waiting, `1` means
approved, `2` means rejected. `receivedAt` is when the request came in.
`approvedAt` looks strange here — that huge negative number is just the
computer's way of representing "this has never happened," since the device
hasn't been approved yet. Once someone approves it, `approvedAt` becomes a
normal, recent timestamp like `receivedAt`.

**Visit:** `GET /api/v1/enrollments` — needs the API key. Same list, but
including every device ever seen — pending, approved, and rejected — not just
the ones still waiting.

**Visit:** `POST /api/v1/enrollments/{mac}/approve` — needs the admin key.
Approves a waiting device and, optionally, gives it a name, zone, and type in
the same step (swap `{mac}` for the device's hardware serial number from the
pending list above).

```bash
curl -X POST http://your-server:8080/api/v1/enrollments/aa:bb:cc:dd:ee:ff/approve \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "entrance-left", "zone": "lobby", "type": "pir", "nodeId": 3}'
```

```json
{ "success": true, "message": "enrollment approved" }
```

**Visit:** `POST /api/v1/enrollments/{mac}/reject` — needs the admin key.
Turns away a device that shouldn't join.

```bash
curl -X POST http://your-server:8080/api/v1/enrollments/aa:bb:cc:dd:ee:ff/reject \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "success": true, "message": "enrollment rejected" }
```

**Use this when:** you've just powered on a new sensor or light and it isn't
showing up in your device list yet — check the pending list, confirm it's the
device you expect by matching the hardware serial number on its label, then
approve or reject it.

---

## 7. Watching things happen live

**Visit:** `GET /api/v1/events` — no key needed. Unlike every other address
in this guide, this one doesn't reply once and stop — it stays open and
streams a small message every time something happens in the installation.
It's meant for software (a dashboard, a lighting cue system) to stay
subscribed to, rather than something you'd check by hand.

```javascript
const events = new EventSource("http://your-server:8080/api/v1/events");

events.addEventListener("motion", (e) => {
  const data = JSON.parse(e.data);
  console.log(`Motion at ${data.name} in ${data.zone}`);
});
```

Here's what actually arrives in `data` the moment a motion sensor triggers:

```json
{ "nodeId": 3, "name": "entrance-left", "zone": "lobby", "hopCount": 1, "timestamp": "2026-08-10T12:00:00Z" }
```

That's the `motion` message. There are a handful of other message types you
can listen for the same way, each carrying only the details relevant to it:

| Message | What just happened |
| --- | --- |
| `motion` | A motion sensor was triggered. |
| `health` | A device checked in with its current status. |
| `node_online` | A device that was offline is reachable again. |
| `node_offline` | A device stopped checking in and is now considered offline. |
| `enrolled` | A new device was approved and given a name/type. |
| `command_ack` | A device confirmed it carried out a command you sent. |
| `route_update` | A device's path back to the server (which device it relays through) changed. |

**Use this when:** you're building a live view of the installation — a
dashboard showing motion as it happens, or lighting cues that react to
sensors in real time — rather than repeatedly asking "did anything change
yet?"

---

## Want more detail?

This guide deliberately leaves things out — zone management, legacy routes
kept for backwards compatibility, and the exact byte-level wire format are
all outside its scope, because the goal here is orientation, not completeness.
For the full, formal picture:

- [`server/orchestrator/examples/api_examples.md`](../server/orchestrator/examples/api_examples.md)
  — the developer-facing quick reference, with every request as raw `curl`
  and JSON, no prose.
- [`server/orchestrator/openapi/v1.yaml`](../server/orchestrator/openapi/v1.yaml)
  — the formal OpenAPI specification: every address, every field, every
  possible response, machine-readable.
