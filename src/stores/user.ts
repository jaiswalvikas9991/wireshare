import { UserId } from "$src/lib/models/types";
import { createSignal } from "solid-js";

const userIdSignal = createSignal<UserId | null>(null);

export default userIdSignal;

