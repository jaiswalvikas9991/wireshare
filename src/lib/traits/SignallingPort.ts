interface SignallingPort {
  send(msg: string): unknown;
  onMsg(handler: (msg: string) => unknown): void;
}


export default SignallingPort;
