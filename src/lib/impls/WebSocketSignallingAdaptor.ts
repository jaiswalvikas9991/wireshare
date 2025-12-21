import { WS_URL } from "$src/lib/utils/Constants";
import SignallingPort from "../traits/SignallingPort";

class WebSocketSignallingAdaptor implements SignallingPort {
    inner: WebSocket;
    pingTimeout: number | null = null;

    constructor() {
        this.inner = new WebSocket(`${WS_URL}`);
    }

    private heartbeat = () => {
        if(this.pingTimeout !== null) {
            clearTimeout(this.pingTimeout);
        }

        this.pingTimeout = setTimeout(() => {
            this.inner.close();
        }, 30000 + 5000);
    }

    isConnectionAlive(): boolean {
        return this.inner.readyState === WebSocket.OPEN;
    }

    close(): unknown {
        return this.inner.close();
    }

    send(msg: string): unknown {
        return this.inner.send(msg);
    }

    onMsg(handler: (msg: string) => unknown): void {
        this.inner.onmessage = (e: MessageEvent<unknown>) => {
            this.heartbeat();
            const data = e.data;
            if (typeof data !== 'string') {
                console.error('Got ', data, ' of unknown type');
                return;
            } 
            if(data == 'heartbeat') {
                console.info('Got ', data, ' this is a heartbeat');
                return;
            }
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

