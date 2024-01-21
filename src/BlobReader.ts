import { toBase256 } from "./lib/utils/utils";

export class BlobReader {
  blob: Blob;
  currentOffset: number;
  static indexSize = 5;

  constructor(blob: Blob, currentOffset: number) {
    this.blob = blob;
    this.currentOffset = currentOffset;
  }

  /**
  * Only call is **isReadCompleted** returns false
  **/
  read(howMuchInBytes: number): Promise<ArrayBuffer> {
    const currentEndOffset = Math.min(this.currentOffset + howMuchInBytes, this.blob.size);
    const blob = this.blob.slice(this.currentOffset, currentEndOffset);
    // Check this with GPT
    const blobWithOffset = new Blob([
      blob,
      new Blob([new Uint8Array(toBase256(this.currentOffset))])
    ]);
    this.currentOffset = currentEndOffset;
    return new Response(blobWithOffset).arrayBuffer();
  }


  //setOffset(offset: number) {
  //  this.currentOffset = offset;
  //}

  isReadComplete() {
    return this.currentOffset >= this.blob.size;
  }
}
