import { globalState } from "$src/GlobalState";
import Loading from "$src/components/Loading";
import { LocalStorage } from "$src/lib/impls/DexieDb";
import Machine from "$src/lib/impls/Machine";
import WebSocketSignallingAdaptor from "$src/lib/impls/WebSocketSignallingAdaptor";
import userIdSignal from "$src/stores/user";
import { Component, For, Show, createSignal, onMount } from "solid-js";
import { filesQueuedToBeSentSignal, sendingFileInfoSignal, sentFilesSignal, receivedFilesSignal, filesPausedToBeSentSignal, filesPausedToBeReceivedSignal } from "$src/stores/files";
import ClipboardSvg from "$src/components/ClipboardSvg";
import peerIdSignal from "$src/stores/peer";
import CrossSvg from "$src/components/CrossSvg";
import InputCard from "$src/components/InputCard";
import PeerSearch from "$src/components/PeerSearch";
import { ToBeSentFile } from "$src/lib/models/types";
import { panic } from "$src/lib/utils/Error";
import ErrorPopup from "$src/components/ErrorPopup";
import Navbar from "$src/components/Navbar";


const handleConnect = (peerId: string) => {
  console.log('Will try to conenct to ', peerId);
  if (!globalState.machine) return panic();
  globalState.machine.connect(peerId);
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

const makeLocalDb = async () => {
  globalState.localStorage = new LocalStorage();
  const sentFiles = await globalState.localStorage.getAllSentFiles();
  const receivedFiles = await globalState.localStorage.getAllReceivedFiles();

  sentFilesSignal[1](cur => {
    const newFiles = sentFiles.filter(e => e.completed).map(e => ({ filename: e.name, size: e.size }));
    return [...cur, ...newFiles];
  });

  receivedFilesSignal[1](cur => {
    const newFiles = receivedFiles.filter((e) => e.completed).map(e => ({ filename: e.name, size: e.size }));
    return [...cur, ...newFiles];
  });

  filesPausedToBeSentSignal[1](cur => {
    const newFiles = sentFiles.filter(e => !e.completed).map(e => ({ file: e.file }));
    return [...cur, ...newFiles];
  });

  filesPausedToBeReceivedSignal[1](cur => {
    const newFiles = receivedFiles.filter(e => !e.completed).map(e => ({ name: e.name, size: e.size, alreadyReceived: e.chunks.map(e => e.size).reduce((acc, e) => acc + e, 0) }));
    return [...cur, ...newFiles];
  });
};

const UserClipboardCard = (userId: string) => {
  return (
    <div class="dropdown dropdown-hover">
      <div class="avatar placeholder">
        <div class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
          <span class="text-2xl">
            {userId ? userId.substring(0, Math.min(userId.length, 3)) : 'UNK'}
          </span>
        </div>
      </div>
      <div
        class="dropdown-content shadow bg-neutral rounded-box flex flex-row items-center w-40 sm:w-60 card text-neutral-content break-all"
      >
        <div class="card-body p-1 flex flex-1 flex-row items-center">
          <p>{userId}</p>
          <span
            class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent p-0"
            onclick={() => userId && copyTextToClipboard(userId)}
          >
            <ClipboardSvg />
          </span>
        </div>
      </div>
    </div>
  );
};

const onDisconnectPeer = () => {
  if (!globalState.machine) return panic();

  globalState.machine.disconnect();
};

const PeerClipboardCard = (peerId: string) => {
  return (
    <div class="dropdown dropdown-end dropdown-hover">
      <div class="avatar placeholder">
        <div class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
          <span class="text-2xl">
            {peerId
              ? peerId.substring(0, Math.min(peerId.length, 3))
              : 'UNK'}
          </span>
        </div>
      </div>

      <div
        class="dropdown-content shadow bg-neutral rounded-box flex flex-row items-center w-56 sm:w-72 card text-neutral-content break-all"
      >
        <div class="card-body p-1 flex flex-1 flex-row items-center">
          <p>{peerId}</p>
          <span
            class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent p-0"
            onclick={onDisconnectPeer}
          >
            <CrossSvg />
          </span>

          <span
            class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent p-0"
            onclick={() => copyTextToClipboard(peerId)}
          >
            <ClipboardSvg />
          </span>
        </div>
      </div>
    </div>
  );
};


const WhenHaveUserIdPart = (userId: string) => {
  const [peerId] = peerIdSignal;
  const [addedFiles, setAddedFiles] = createSignal<File[]>([]);


  const onFileRemoveButtonClicked = (fileName: string) => {
    console.log("Will try to remove ", fileName);
    setAddedFiles(cur => cur.filter(e => e.name !== fileName));
  };


  const onMoreFilesAdded = (files: File[]) => {
    if (files.length <= 0) return;
    setAddedFiles(e => [...e, ...files]);
  };

  const triggerNextFileSent = () => {
    if (!globalState.machine) return panic();
    const [toBeSentFiles, _stbs] = filesQueuedToBeSentSignal;

    const toBeQueued = toBeSentFiles().at(0);
    if (!toBeQueued) return panic();

    globalState.machine.sendFile(toBeQueued.file);
  };

  const onFileSent = () => {
    const files = addedFiles();
    if (!files) return;

    const fileList = new Array<ToBeSentFile>();
    for (const file of files) {
      fileList.push({ file: file });
    }

    if (fileList.length <= 0) return;

    filesQueuedToBeSentSignal[1](e => [...e, ...fileList]);
    setAddedFiles([]);
    triggerFileSent();
  };



  const triggerFileSent = () => {
    // This means something need to be queued
    const [toBeSentFiles] = filesQueuedToBeSentSignal;
    const [sendingFileInfo] = sendingFileInfoSignal;

    if (!!sendingFileInfo() || toBeSentFiles().length <= 0) return;
    triggerNextFileSent();
  };


  return (
    <>
      <div class="flex flex-1 flex-col justify-center items-center pt-5 space-y-1">
        <div class="flex w-full flex-row justify-center items-center">
          {UserClipboardCard(userId)}

          <Show when={peerId() !== null}>
            <div class="w-1/3 md:w-1/4 bg-primary h-1" />
            {PeerClipboardCard(peerId()!)}
          </Show>
        </div>


        <div class="flex-1 flex flex-col justify-center items-center w-full">
          <Show when={peerId() !== null}>
            <div class="card w-4/5 md:w-2/4 lg:w-4/12 bg-primary text-primary-content">
              <div class="card-body p-4">
                <Show when={addedFiles().length > 0}>
                  <ul
                    class="bg-base-100 w-full h-min max-h-48 p-2 rounded-box overflow-y-scroll overflow-x-hidden no-scrollbar"
                  >
                    <For each={addedFiles()}>
                      {(file, _id) =>
                        <li id={file.name} class="card flex flex-row items-center flex-1">
                          <div class="card-body flex-1 flex-row p-2">
                            <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{file.name}</h2>
                            <span
                              class="btn btn-outline btn-circle btn-error cursor-pointer border-transparent"
                              onclick={() => onFileRemoveButtonClicked(file.name)}
                            >
                              <CrossSvg />
                            </span>
                          </div>
                        </li>
                      }
                    </For>
                  </ul>
                  <div class="card-actions w-full">
                    <label for="file-upload" class="flex-1 btn">
                      <span>Add Files</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        multiple={true}
                        class="sr-only"
                        onchange={e => e.currentTarget.files !== null && onMoreFilesAdded([...e.currentTarget.files])}
                      />
                    </label>
                    <button class="btn flex-1" onclick={onFileSent}>Send</button>
                  </div>
                </Show>
                <Show when={addedFiles().length === 0}>
                  <InputCard onFilesAdded={onMoreFilesAdded} />
                </Show>
              </div>
            </div>
          </Show>

          <Show when={peerId() == null}>
            <input
              type="checkbox"
              id="search-label"
              class="modal-toggle"
            />
            <label for="search-label" class="modal cursor-pointer backdrop-blur-md">
              <label class="modal-box w-11/12 max-w-5xl relative p-2" for="">
                <PeerSearch onclick={handleConnect} />
              </label>
            </label>
            <label for="search-label" class="btn btn-primary modal-button">Connect to a peer</label>
          </Show>
        </div>
      </div>
    </>
  );
};


const [msg, setMsg] = createSignal<string | null>(null);
const OneToOne: Component = () => {
  const [userId] = userIdSignal;
  const [loading, setLoading] = createSignal<boolean>(true);

  onMount(async () => {
    setLoading(true);

    const signallingAdaptor = new WebSocketSignallingAdaptor('global')
    globalState.machine = new Machine(signallingAdaptor);
    await makeLocalDb();

    setLoading(false);
  });

  return (
    <div class="h-screen w-screen relative flex flex-col">
      <input type="checkbox" id="loading-modal" class="modal-toggle" checked={loading()} />
      <div class="modal backdrop-blur-md">
        <div class="modal-box p-0">
          <Loading />
        </div>
      </div>

      <Navbar />

      <ErrorPopup msg={msg()} onclose={() => setMsg(null)} />

      <Show when={userId()}>
        {WhenHaveUserIdPart(userId()!)}
      </Show>
    </div>
  );
}

export default OneToOne;

