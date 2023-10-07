import Machine from "$src/lib/impls/Machine";
import WebSocketSignallingAdaptor from "$src/lib/impls/WebSocketSignallingAdaptor";
import SignallingPort from "$src/lib/traits/SignallingPort";
import roomIdSignal from "$src/stores/room";
import userIdSignal from "$src/stores/user";
import { useParams } from "@solidjs/router";
import {
  Component,
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  onMount,
  Show,
  Suspense,
} from "solid-js";
import { RoomId, UserId } from "src/lib/models/types";
import { HTTP_URL } from "src/lib/utils/Constants";
import { flowError, panic } from "src/lib/utils/Error";
import SocketFactory from "src/lib/utils/SocketFactory";

type IsValidRoomRes = {
  isValid: boolean;
};
const isValidRoom = async (roomId: string) => {
  const res = await fetch(`${HTTP_URL}/isValidRoom?roomId=${roomId}`);
  if (!res) return flowError();
  const json = await res.json();
  if (!json || typeof json !== "object") return flowError();
  const msg = json as IsValidRoomRes;
  return msg.isValid;
};


//type AllUsers = {
//  "AllUsers": {
//    users: [UserId];
//  };
//};
//type UserAdded = {
//  "UserAdded": {
//    user: UserId;
//  };
//};
//type UserRemoved = {
//  "UserRemoved": {
//    user: UserId;
//  };
//};

//type WebSocketMsg = AllUsers | UserAdded | UserRemoved;
//const onmessage = (e: MessageEvent<string>) => {
//  let data = e.data;
//  if (!data) return false;
//  let json = JSON.parse(data) as unknown;
//  if (!json || typeof json !== "object") return false;
//  const msg = json as WebSocketMsg;
//
//  if ("AllUsers" in msg) {
//    let data = msg.AllUsers;
//    console.log(data);
//    return true;
//  }
//
//  if ("UserAdded" in msg) {
//    let data = msg.UserAdded;
//    console.log(data);
//    return true;
//  }
//  if ("UserRemoved" in msg) {
//    let data = msg.UserRemoved;
//    console.log(data);
//    return true;
//  }
//  return false;
//};
//
//
//type JoinedRoomRes = {
//  "JoinedRoom": {
//    roomId: string;
//  };
//};

//type WebSocketMsg = JoinedRoomRes;
//const onmessage = (e: MessageEvent<string>) => {
//  let data = e.data;
//  if (!data) return false;
//  let json = JSON.parse(data) as unknown;
//  if (!json || typeof json !== "object") return false;
//  const msg = json as WebSocketMsg;
//
//  if ("JoinedRoom" in msg) {
//    let data = msg.JoinedRoom;
//    setRoomId(data.roomId);
//    return true;
//  }
//
//  return false;
//};
//const createRoomWithRoomId = (userId: string, roomId: string) => {
//  SocketFactory.init(userId, roomId);
//  const socket = SocketFactory.get();
//  socket.addOnMsgHandler(onmessage);
//};

type CreateRoomRes = {
  roomId: string;
};
const createRoom = async () => {
  const res = await fetch(`${HTTP_URL}/createRoom`);
  if (!res) return flowError();
  const json = await res.json();
  if (!json || typeof json !== "object") return flowError();
  const msg = json as CreateRoomRes;
  return msg.roomId;
};




type PathParam = {
  roomId: string;
};

let machine: Machine | null = null;
let signallingAdaptor: SignallingPort | null = null;
const makeMachine = (roomId: string) => {
  signallingAdaptor = new WebSocketSignallingAdaptor(roomId)
  machine = new Machine(signallingAdaptor);
}

const Home: Component = () => {
  const [userId, _] = userIdSignal;
  const [roomId, __] = roomIdSignal;

  const pathParams = useParams<PathParam>();


  onMount(async () => {
    let roomId = pathParams.roomId;
    if (!!roomId) {
      const isRoomValid = await isValidRoom(roomId);
      if (!isRoomValid) return panic();
    }
    else {
      roomId = await createRoom();
    }
    // Making a websocket connection
    makeMachine(roomId);
  });

  const [peerId, setPeerId] = createSignal<string>('');


  const handleConnect = () => {
    if (!machine) return panic();
    machine.connect(peerId());
  };

  return (

    <>
      <Show when={userId() && roomId()} fallback={
        <h1>Loading...</h1>
      }>
        <h1>UserId: {userId()}</h1>
        <h1>RoomId: {roomId()}</h1>

        <input type="text" value={peerId()} onchange={(e) => setPeerId(e.currentTarget.value)} />
        <button onclick={handleConnect}>Connect</button>
      </Show>
    </>
  );
};

export default Home;
