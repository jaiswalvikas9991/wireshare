interface SignallingPort {
  send(msg: string): unknown;
  onMsg(handler: (msg: string) => unknown): void;
  onErr(handler: () => unknown): void;
  onClose(handler: () => unknown): void;
}


export default SignallingPort;
