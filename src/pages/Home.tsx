import { globalState } from "$src/GlobalState";
import Loading from "$src/components/Loading";
import { LocalStorage } from "$src/lib/impls/DexieDb";
import Machine from "$src/lib/impls/Machine";
import WebSocketSignallingAdaptor from "$src/lib/impls/WebSocketSignallingAdaptor";
import userIdSignal from "$src/stores/user";
import { Component, For, Show, createSignal, onMount } from "solid-js";
import { filesQueuedToBeSentSignal, sentFilesSignal, receivedFilesSignal, filesPausedToBeSentSignal, filesPausedToBeReceivedSignal } from "$src/stores/files";
import ClipboardSvg from "$src/components/ClipboardSvg";
import peerIdSignal from "$src/stores/peer";
import CrossSvg from "$src/components/CrossSvg";
import InputCard from "$src/components/InputCard";
import PeerSearch from "$src/components/PeerSearch";
import { ToBeSentFile } from "$src/lib/models/types";
import { panic } from "$src/lib/utils/Error";
import ErrorPopup from "$src/components/ErrorPopup";
import Navbar from "$src/components/Navbar";
import { copyTextToClipboard, triggerFileSent } from "$src/Common";
import { errroMsgSignal } from "$src/stores/errorMsg";
import { loadingSignal } from "$src/stores/loading";


const handleConnect = (peerId: string) => {
  if (!globalState.machine) return panic();
  globalState.machine.connect(peerId);
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
    <div class="dropdown">
      <div tabindex="0" role="button" class="avatar placeholder">
        <div class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
          <span class="text-2xl">
            {userId ? userId.substring(0, Math.min(userId.length, 3)) : 'UNK'}
          </span>
        </div>
      </div>
      <div
        tabindex="0"
        class="dropdown-content shadow bg-neutral rounded-box flex flex-row items-center w-40 sm:w-60 card text-neutral-content break-all"
      >
        <div class="card-body p-0 flex flex-1 flex-row items-center">
          <p class="ml-4">{userId}</p>
          <span
            class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent p-0"
            onclick={() => copyTextToClipboard(userId)}
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
    <div class="dropdown dropdown-end">
      <div tabindex="0" role="button" class="avatar placeholder">
        <div class="w-20 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
          <span class="text-2xl">
            {peerId
              ? peerId.substring(0, Math.min(peerId.length, 3))
              : 'UNK'}
          </span>
        </div>
      </div>

      <div
        tabindex="0"
        class="dropdown-content shadow bg-neutral rounded-box flex flex-row items-center w-56 card text-neutral-content break-all"
      >
        <div class="card-body p-0 flex flex-1 flex-row items-center">
          <p class="ml-4">{peerId}</p>
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
    setAddedFiles(cur => cur.filter(e => e.name !== fileName));
  };


  const onMoreFilesAdded = (files: File[]) => {
    if (files.length <= 0) return;

    setAddedFiles(e => [...e, ...files]);
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

    const names = fileList.map(e => e.file.name);
    const [_s, setSentFiles] = sentFilesSignal;
    const [_f, setFilesPausedToBeSent] = filesPausedToBeSentSignal;
    setSentFiles(cur => cur.filter(e => !names.includes(e.filename)));
    setFilesPausedToBeSent(cur => cur.filter(e => !names.includes(e.file.name)));

    setAddedFiles([]);
    triggerFileSent();
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
                    <label id="file-upload-label" for="file-upload" class="flex-1 btn">
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
            <label id="search-label" for="search-label" class="modal cursor-pointer backdrop-blur-md">
              <label id="random-id-1" class="modal-box w-11/12 max-w-5xl relative p-2" for="">
                <PeerSearch onclick={handleConnect} />
              </label>
            </label>
            <label id="random-id-2" for="search-label" class="btn btn-primary modal-button">Connect to a peer</label>
          </Show>
        </div>
      </div>
    </>
  );
};


const Home: Component = () => {
  const [userId] = userIdSignal;
  const [loading, setLoading] = loadingSignal;
  const [errroMsg, setErrroMsg] = errroMsgSignal;

  onMount(async () => {
    setLoading(true);

    const signallingAdaptor = new WebSocketSignallingAdaptor();
    globalState.machine = new Machine(signallingAdaptor);
    await makeLocalDb();
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

      <ErrorPopup msg={errroMsg()} onclose={() => setErrroMsg(null)} />

      <Show when={userId()}>
        {WhenHaveUserIdPart(userId()!)}
      </Show>
    </div>
  );
}

export default Home;

