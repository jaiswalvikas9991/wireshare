import { WS_URL } from "$src/lib/utils/Constants";
import SignallingPort from "../traits/SignallingPort";

class WebSocketSignallingAdaptor implements SignallingPort {
    inner: WebSocket;

    constructor() {
        this.inner = new WebSocket(`${WS_URL}/`);
    }

    send(msg: string): unknown {
        return this.inner.send(msg);
    }

    onMsg(handler: (msg: string) => unknown): void {
        this.inner.onmessage = (e: MessageEvent<unknown>) => {
            const data = e.data;
            if (typeof data !== 'string') return;
            handler(data);
        };
    }

    onErr(handler: () => unknown): void {
        this.inner.onerror = () => {
            handler();
        };
    }

    onClose(handler: () => unknown): void {
        this.inner.close = () => {
            handler();
        };
    }
}

export default WebSocketSignallingAdaptor;

