import { RoomId } from "../models/types";

interface SignallingPort {
  getRoomId(): RoomId,
  send(msg: string): unknown;
  onMsg(handler: (msg: string) => unknown): void;
}


export default SignallingPort;
