import { UserId } from "$src/lib/models/types";
import { createSignal } from "solid-js";

const peerIdsInRoomSignal = createSignal<UserId[]>([]);

export default peerIdsInRoomSignal;
