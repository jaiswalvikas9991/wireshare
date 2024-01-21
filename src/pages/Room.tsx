import { globalState } from "$src/GlobalState";
import ClipboardSvg from "$src/components/ClipboardSvg";
import { LocalStorage } from "$src/lib/impls/DexieDb";
import Machine from "$src/lib/impls/Machine";
import WebSocketSignallingAdaptor from "$src/lib/impls/WebSocketSignallingAdaptor";
import { ToBeSentFile } from "$src/lib/models/types";
import { filesQueuedToBeSentSignal, sendingFileInfoSignal, sentFilesSignal, receivedFilesSignal, sentBytesSignal, receivingFileInfoSignal, receivedBytesSignal } from "$src/stores/files";
import peerIdSignal from "$src/stores/peer";
import peerIdsInRoomSignal from "$src/stores/peers";
import roomIdSignal from "$src/stores/room";
import userIdSignal from "$src/stores/user";
import { useParams } from "@solidjs/router";
import {
  Component,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { panic } from "src/lib/utils/Error";



type PathParam = {
  roomId: string;
};


type EventType = Event & {
  currentTarget: HTMLInputElement;
  target: Element;
};
const onMoreFilesAdded = (e: EventType) => {
  const files = e.currentTarget.files;
  if (!files) return;

  const fileList = new Array<ToBeSentFile>();
  for (let i = 0; i < files.length; i++) {
    const file = files.item(i);
    if (!file) continue;
    fileList.push({ file: file });
  }

  if (fileList.length <= 0) return;

  const [_toBeSentFiles, setToBeSentFiles] = filesQueuedToBeSentSignal;
  setToBeSentFiles(e => [...e, ...fileList]);
};


const triggerNextFileSent = () => {
  if (!globalState.machine) return panic();
  const [toBeSentFiles, _stbs] = filesQueuedToBeSentSignal;

  const toBeQueued = toBeSentFiles().at(0);
  if (!toBeQueued) return panic();

  globalState.machine.sendFile(toBeQueued.file);
};


const onSent = () => {
  // This means something need to be queued
  const [toBeSentFiles, _st] = filesQueuedToBeSentSignal;
  const [sendingFileInfo, _ss] = sendingFileInfoSignal;

  if (!!sendingFileInfo() || toBeSentFiles().length <= 0) return;
  triggerNextFileSent();
};

const makeLocalDb = async () => {
  globalState.localStorage = new LocalStorage();
  const sentFiles = await globalState.localStorage.getAllSentFiles();
  const receivedFiles = await globalState.localStorage.getAllReceivedFiles();

  sentFilesSignal[1](cur => {
    const newFiles = sentFiles.filter(e => e.completed).map(e => ({ filename: e.name, size: e.size }));
    if (!cur) return newFiles;
    return [...cur, ...newFiles];
  });

  receivedFilesSignal[1](cur => {
    const newFiles = receivedFiles.filter((e) => e.completed).map(e => ({ filename: e.name, size: e.size }));
    if (!cur) return newFiles;
    return [...cur, ...newFiles];
  });

  filesQueuedToBeSentSignal[1](cur => {
    const newFiles = sentFiles.filter(e => !e.completed).map(e => ({ file: e.file }));
    if (!cur) return newFiles;
    return [...cur, ...newFiles];
  });
};


const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
};

const handleDeleteSentFile = async (filename: string) => {
  if (!globalState.localStorage) panic();
  globalState.localStorage?.deleteSendingFileBy(filename);
};

const handleDownlaodFile = async (filename: string) => {
  if (!globalState.localStorage) panic();
  const chunks = await globalState.localStorage?.getAllSplitsBy(filename);
  downloadBlob(new Blob(chunks), filename);
};


const hashCode = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};

const getRandomAvatarImageUrlBy = (uuid: string) => {
  const sprites = [
    'male',
    'female',
    'human',
    'identicon',
    'initials',
    'bottts',
    'avataaars',
    'jdenticon',
    'gridy',
    'micah'
  ];
  const idx = ((hashCode(uuid) % sprites.length) + sprites.length) % sprites.length;
  return `https://avatars.dicebear.com/api/${sprites[idx]}/${uuid}.svg`;
};

const getImageBlobObjectUrl = async (src: string) => {
  const resp = await fetch(src);
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
};


const fallbackCopyTextToClipboard = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const successful = document.execCommand('copy');
  if (!successful) throw new Error('Copying Failed');
  document.body.removeChild(textArea);
};

const copyTextToClipboard = async (text: string) => {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  return await navigator.clipboard.writeText(text);
};

const Room: Component = () => {
  const pathParams = useParams<PathParam>();

  const [userId, _su] = userIdSignal;
  const [roomId, _sr] = roomIdSignal;

  const [peerIdsInRoom, _spir] = peerIdsInRoomSignal;
  const [peerId, _sp] = peerIdSignal;

  const [sendingFileInfo, _ssfi] = sendingFileInfoSignal;
  const [sentBytes, _ssb] = sentBytesSignal;


  const [receivingFileInfo, _srfi] = receivingFileInfoSignal;
  const [receivedBytes, _srb] = receivedBytesSignal;

  // const [peerIdInput, setPeerIdInput] = createSignal<string>('');

  const [filesQueuedToBeSent, _sfqs] = filesQueuedToBeSentSignal;

  const [receivedFiles, _srf] = receivedFilesSignal;
  const [sentFiles, _ssf] = sentFilesSignal;


  onMount(async () => {
    const signallingAdaptor = new WebSocketSignallingAdaptor(pathParams.roomId)
    globalState.machine = new Machine(signallingAdaptor);
    makeLocalDb();
  });



  const handleConnect = () => {
    if (!globalState.machine) return panic();
    globalState.machine.connect(peerIdInput());
  };

  return (
    <>

      <div class="card p-1 flex flex-row items-center">
        <p>RoomId: {roomId()}</p>
        <span
          class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent p-0"
          onclick={() => roomId() && copyTextToClipboard(`http://localhost:3000/${roomId()!}`)}
        >
          <ClipboardSvg />
        </span>
      </div>


      <h1>Peers in the room</h1>
      <div class="h-24">
        <For each={peerIdsInRoom()}>{(peerId, _i) =>
          <div class="card bg-base-100 shadow-xl flex flex-row">

            <div class="avatar placeholder">
              <div class="bg-neutral text-neutral-content rounded-full w-24 h-24">
                <span class="text-3xl">D</span>
              </div>
            </div>

            <div class="card-body">
              <p class="card-title">{peerId}</p>
              <div class="card-actions justify-end">
                <button class="btn btn-primary">Send</button>
              </div>
            </div>

          </div>

        }</For>
      </div>

      <Show when={peerId()}>
        {peerId()} connected

        <input
          id="file-upload"
          name="file-upload"
          type="file"
          multiple={true}
          onchange={onMoreFilesAdded}
        >Add files</input>

        <For each={filesQueuedToBeSent()}>
          {(file, _i) =>
            <li id={file.file.name}>
              {file.file.name}
            </li>
          }
        </For>

        <Show when={!sendingFileInfo() && filesQueuedToBeSent().length > 0}>
          <button onclick={onSent}>Send</button>
        </Show>

        <Show when={sendingFileInfo()}>
          <h1>Currently sending file</h1>
          <h1>{sendingFileInfo()?.file.name}-{sentBytes()}</h1>
        </Show>

        <Show when={receivingFileInfo()}>
          <h1>Currently receiving file</h1>
          <h1>{receivingFileInfo()?.name}-{receivedBytes()}</h1>
          <button onclick={() => handleDownlaodFile(receivingFileInfo()?.name)}>Download</button>
        </Show>


        <Show when={sentFiles().length > 0}>
          <h1>Sent Files</h1>
          <For each={sentFiles()}>{(e, _i) =>
            <li id={e.filename} onclick={() => handleDeleteSentFile(e.filename)}>
              {e.filename}-{e.size}-Delete
            </li>
          }</For>

        </Show>


        <Show when={receivedFiles().length > 0}>
          <h1>Received Files</h1>
          <For each={receivedFiles()}>{(e, _i) =>
            <li id={e.filename} onclick={() => handleDownlaodFile(e.filename)}>
              {e.filename}-{e.size}-Save
            </li>
          }</For>

        </Show>

      </Show>
    </>
  );
};

export default Room;
