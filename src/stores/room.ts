import { RoomId } from "$src/lib/models/types";
import { createSignal } from "solid-js";

const roomIdSignal = createSignal<RoomId | null>(null);

export default roomIdSignal;

