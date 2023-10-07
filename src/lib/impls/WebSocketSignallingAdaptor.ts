import { WS_URL } from "$src/lib/utils/Constants";
import { RoomId } from "../models/types";
import SignallingPort from "../traits/SignallingPort";

class WebSocketSignallingAdaptor implements SignallingPort {
    inner: WebSocket;
    roomId: RoomId;

    constructor(roomId: string) {
        this.roomId = roomId;
        this.inner = new WebSocket(`${WS_URL}/${roomId}`);
    }


    getRoomId(): string {
        return this.roomId;
    }


    send(msg: string): unknown {
        return this.inner.send(msg);
    }

    onMsg(handler: (msg: string) => unknown): void {
        this.inner.onmessage = (e: MessageEvent<unknown>) => {
            const data = e.data;
            if (typeof data !== 'string') return;
            console.log(data);
            handler(data);
        };
    }
}

export default WebSocketSignallingAdaptor;

