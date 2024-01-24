class ByteArray {
  inner: Uint8Array;

  constructor(size: number) {
    this.inner = new Uint8Array(size);
  }

  set(data: Uint8Array, offset: number) {
    this.inner.set(data, offset);
  }

  getBlob() {
    return new Blob([this.inner]);
  }
}


export default ByteArray;

