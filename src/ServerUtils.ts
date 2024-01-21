import { HTTP_URL } from "./lib/utils/Constants";
import { flowError } from "./lib/utils/Error";

type IsValidRoomRes = {
  isValid: boolean;
};
export const isValidRoom = async (roomId: string) => {
  const res = await fetch(`${HTTP_URL}/isValidRoom?roomId=${roomId}`);
  if (!res) return flowError();
  const json = await res.json();
  if (!json || typeof json !== "object") return flowError();
  const msg = json as IsValidRoomRes;
  return msg.isValid;
};

type CreateRoomRes = {
  roomId: string;
};
export const createRoom = async () => {
  const res = await fetch(`${HTTP_URL}/createRoom`);
  if (!res) return flowError();
  const json = await res.json();
  if (!json || typeof json !== "object") return flowError();
  const msg = json as CreateRoomRes;
  return msg.roomId;
};




type CreateUserId = {
  userId: string;
};
export const createUserId = async () => {
  const res = await fetch(`${HTTP_URL}/userId`);
  if (!res) return flowError();
  const json = await res.json();
  if (!json || typeof json !== "object") return flowError();
  const msg = json as CreateUserId;
  return msg.userId;
};
