import { toBase256 } from "../utils/utils";

export class BlobReaderAdapter {
    blob: Blob;
    currentOffset: number;

    constructor(blob: Blob, currentOffset = 0) {
        this.blob = blob;
        this.currentOffset = currentOffset;
    }

    async read(howMuchInBytes: number): Promise<ArrayBuffer | null> {
        if (this.currentOffset >= this.blob.size) return null;
        const currentEndOffset = Math.min(this.currentOffset + howMuchInBytes, this.blob.size);
        const blob = this.blob.slice(this.currentOffset, currentEndOffset);
        const blobWithOffset = new Blob([
            blob,
            new Blob([new Uint8Array(toBase256(this.currentOffset))])
        ]);
        this.currentOffset = currentEndOffset;
        return await new Response(blobWithOffset).arrayBuffer();
    }
}
