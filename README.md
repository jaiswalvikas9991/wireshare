# Wireshare

Wireshare is a browser-based peer-to-peer file sharing app built with SolidJS, WebRTC, and WebSocket signaling. Files are transferred directly between connected browsers over an encrypted WebRTC data channel, so the file contents are not uploaded to the application server.

Live demo: https://wireshare.vercel.app/

> Note: the signaling backend for the demo is hosted on a free server. If it has been idle, the first connection attempt may be slow or may fail while the server wakes up. Wait a short moment, refresh, and try again.

Backend repository: https://github.com/jaiswalvikas9991/wireshare-backend

## Features

- Peer-to-peer file transfer using WebRTC data channels.
- No file upload to the backend; the server is only used for peer discovery and connection signaling.
- Encrypted browser-to-browser transfer through WebRTC.
- Supports very large files by splitting file data into chunks.
- Queue multiple files before sending.
- Drag-and-drop or file picker upload flow.
- Transfer progress for both sender and receiver.
- Pause support for active send and receive transfers.
- Resume/requeue support for paused outgoing transfers.
- Transfer history and incomplete transfer state stored locally in the browser with IndexedDB.
- Download received files from the transfer panel.
- Simple peer ID flow for connecting two browsers.

## How It Works

1. Each browser opens a WebSocket connection to the signaling server.
2. The signaling server assigns a user ID.
3. One user shares their ID with another user.
4. The second user enters that peer ID and starts a WebRTC connection.
5. Once connected, selected files are sent directly over a WebRTC data channel.
6. Transfer metadata and chunks are stored locally in IndexedDB so completed and paused transfers can be shown after refresh.

The backend does not handle file payloads. It only helps browsers exchange WebRTC offers, answers, ICE candidates, and connection permission messages.

## Tech Stack

- SolidJS
- TypeScript
- Vite
- Tailwind CSS
- DaisyUI
- Dexie / IndexedDB
- WebRTC data channels
- WebSocket signaling

## Getting Started

### Prerequisites

- Node.js
- pnpm

### Install Dependencies

```bash
pnpm install
```

### Run Locally

```bash
pnpm dev
```

The Vite dev server runs on:

```text
http://localhost:3000
```

### Build

```bash
pnpm build
```

### Preview Production Build

```bash
pnpm serve
```

## Available Scripts

| Script | Description |
| --- | --- |
| `pnpm dev` | Start the local Vite dev server. |
| `pnpm start` | Alias for the Vite dev server. |
| `pnpm build` | Build the app for production. |
| `pnpm serve` | Preview the production build locally. |

## Configuration

The frontend currently uses the WebSocket signaling endpoint defined in:

```text
src/lib/utils/Constants.ts
```

Current demo backend:

```text
wss://wireshare-backend-ucmx.onrender.com
```

For local backend development, update `WS_URL` in that file to your local signaling server URL, for example:

```ts
export const WS_URL = 'ws://localhost:8000';
```

## Project Structure

```text
src/
  components/        UI components for peer connection, file input, transfers, and status panels
  lib/impls/         WebRTC state machine, Dexie storage, blob reader, and signaling adapter
  lib/models/        Shared TypeScript types
  lib/traits/        Signaling interface
  lib/utils/         Shared constants and utility helpers
  pages/             Page-level SolidJS views
  stores/            SolidJS signal stores for app state
```

Important files:

- `src/pages/Home.tsx` initializes local storage, signaling, and the main app view.
- `src/lib/impls/Machine.ts` manages the WebRTC connection and file transfer state machine.
- `src/lib/impls/WebSocketSignallingAdaptor.ts` wraps the WebSocket signaling connection.
- `src/lib/impls/DexieDb.ts` stores sent, received, completed, and paused transfer data in IndexedDB.
- `src/components/NotificationCard.tsx` renders sent and received transfer status.

## Usage

1. Open Wireshare in two browser windows, devices, or browsers.
2. Copy the user ID from one browser.
3. Paste it into the peer ID input in the other browser and connect.
4. After both peers are connected, select or drag files into the upload area.
5. Click **Send**.
6. Use the **Transfers** panel to track sent, received, queued, paused, and completed files.
7. Download received files from the received transfers list.

If a connection fails, try initiating the connection from the other browser. Some network conditions, NAT setups, browser policies, or the demo backend cold start can prevent the first attempt from succeeding.

## Limitations

- The demo signaling backend can cold start because it is hosted on a free server.
- Both peers must keep their browser tabs open during active transfers.
- WebRTC connectivity depends on each peer's network environment.
- The app uses public STUN servers but does not include a TURN relay, so some restrictive networks may not connect.
- Transfer data stored in IndexedDB uses browser storage. Very large files may be limited by available browser storage quota.
- This project is marked as beta in the UI, so some edge cases may still need polish.

## Deployment

The frontend can be deployed as a static Vite app. The demo frontend is hosted on Vercel:

```text
https://wireshare.vercel.app/
```

Make sure the deployed frontend points to a reachable WebSocket signaling server through `WS_URL`.

## License

MIT. See [LICENCE.md](LICENCE.md).
