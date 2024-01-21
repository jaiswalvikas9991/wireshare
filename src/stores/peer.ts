import { UserId } from "$src/lib/models/types";
import { createSignal } from "solid-js";

const peerIdSignal = createSignal<UserId | null>(null);

export default peerIdSignal;

