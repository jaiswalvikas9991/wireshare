class ByteArray {
  inner: Uint8Array;
  size: number;

  constructor(size: number) {
    this.size = size;
    this.inner = new Uint8Array(this.size);
  }

  set(data: Uint8Array, offset: number) {
    this.inner.set(data, offset);
  }

  getBlob() {
    return new Blob([this.inner]);
  }
}


export default ByteArray;

