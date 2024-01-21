import { PausedToBeReceivedFile, PausedToBeSentFiles, ReceivedFile, SentFile, ToBeReceivedFile, ToBeSentFile } from "$src/lib/models/types";
import { createSignal } from "solid-js";

export const filesQueuedToBeSentSignal = createSignal<ToBeSentFile[]>([]);
export const filesPausedToBeSentSignal = createSignal<PausedToBeSentFiles[]>([]);

export const receivedFilesSignal = createSignal<ReceivedFile[]>([]);
export const sentFilesSignal = createSignal<SentFile[]>([]);

export const sendingFileInfoSignal = createSignal<ToBeSentFile | null>(null);
export const sentBytesSignal = createSignal(0);

export const receivingFileInfoSignal = createSignal<ToBeReceivedFile | null>(null);
export const filesPausedToBeReceivedSignal = createSignal<PausedToBeReceivedFile[]>([]);
export const receivedBytesSignal = createSignal(0);



