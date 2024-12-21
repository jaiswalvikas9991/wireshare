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
import ErrorPopup from "$src/components/ErrorPopup";
import Navbar from "$src/components/Navbar";
import { copyTextToClipboard, triggerFileSent } from "$src/Common";
import errroMsgSignal from "$src/stores/errorMsg";
import { loadingSignal } from "$src/stores/loading";
import Wave from "$src/components/Wave";
import PinSvg from "$src/components/PinSvg";
import { Toaster } from 'solid-toast';
import { toastInfo } from "$src/toast";
import { invariantViolation } from "$src/lib/utils/Error";
import SoftwareInfo from "$src/components/SoftwareInfo";
import showSoftwareInfoSignal from "$src/stores/softwareInfo";
import { SHOW_SOFTWARE_INFO_KEY } from "$src/Constants";


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
  const onUserIdCopied = () => {
    copyTextToClipboard(userId)
    toastInfo('userId copied');
  };

  return (
    <div
      class="shadow-md bg-base-100 rounded-box flex flex-row items-center w-60 card break-all"
    >
      <div class="card-body p-0 flex flex-1 flex-row items-center">
        <p class="ml-4">{userId}</p>
        <span
          class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent p-0"
          onclick={onUserIdCopied}
        >
          <ClipboardSvg />
        </span>
      </div>
    </div>
  );
};

const onDisconnectPeer = () => {
  if (!globalState.machine) {
    return invariantViolation('onDisconnectPeer cannot be called when machine is null');
  }

  globalState.machine.disconnect();
};

const PeerClipboardCard = (peerId: string) => {
  const onPeerIdCopied = () => {
    copyTextToClipboard(peerId)
    toastInfo('peerId copied');
  };
  return (
    <div
      class="shadow-md rounded-box flex flex-row items-center w-60 card break-all"
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
          onclick={onPeerIdCopied}
        >
          <ClipboardSvg />
        </span>
      </div>
    </div>
  );
};


const WhenHaveUserIdPart = (userId: string) => {
  const [peerId] = peerIdSignal;
  const [addedFiles, setAddedFiles] = createSignal<File[]>([]);
  const [showSoftwareInfo, setShowSoftwareInfo] = showSoftwareInfoSignal;

  onMount(() => {
    const value = localStorage.getItem(SHOW_SOFTWARE_INFO_KEY);
    if (value !== 'true') {
      setShowSoftwareInfo(true);
    }
    localStorage.setItem(SHOW_SOFTWARE_INFO_KEY, 'true');
  });

  const onCloseSoftwareInfo = () => {
    setShowSoftwareInfo(false);
  }

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

    toastInfo('Sending files. Added to transfers');
  };

  const handleConnect = (peerId: string) => {
    if (!globalState.machine) {
      return invariantViolation('handleConnect cannot be called when machine is null');
    }
    loadingSignal[1](true);
    globalState.machine.connect(peerId);
  };

  return (
    <>
      <div class="flex flex-1 flex-col justify-center items-center pt-5 space-y-1">
        <div class="flex w-full flex-col justify-center items-center">
          {UserClipboardCard(userId)}

          <Show when={peerId() !== null}>
            <div class="divider w-60 self-center">Connected to</div>
            {PeerClipboardCard(peerId()!)}
          </Show>
        </div>


        <div class="flex-1 flex flex-col justify-center items-center w-full">
          <Show when={peerId() !== null}>
            <div class="card 2xl:w-1/4 lg:w-5/12 md:w-2/3 w-9/12">
              <div class="card-body p-0">
                <Show when={addedFiles().length > 0}>
                  <div class="w-full p-2 rounded-box bg-base-100">
                    <ul
                      class="h-min max-h-48 overflow-y-scroll overflow-x-hidden no-scrollbar"
                    >
                      <For each={addedFiles()}>
                        {(file, _id) =>
                          <li id={file.name} class="card flex flex-row items-center flex-1">
                            <div class="card-body flex-1 flex-row p-2">
                              <PinSvg />
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
                      <label id="file-upload-label" for="file-upload" class="flex-1 btn btn-primary">
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
                      <button class="btn btn-primary flex-1" onclick={onFileSent}>Send</button>
                    </div>
                  </div>
                </Show>
                <Show when={addedFiles().length === 0}>
                  <InputCard onFilesAdded={onMoreFilesAdded} />
                </Show>
              </div>
            </div>
          </Show>

          <Show when={peerId() == null}>
            <PeerSearch userId={userId} onclick={handleConnect} />
          </Show>
        </div>
      </div>

      <SoftwareInfo show={showSoftwareInfo()} onclose={onCloseSoftwareInfo} />
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

    try {
      await makeLocalDb();
    }
    catch (e) {
      const errorMsg = 'Failed initialize local db connection. Refresh and try again';
      console.error(errorMsg, e);
      setErrroMsg(errorMsg);
      setLoading(false);
      return;
    }
  });

  return (
    <>
      <Wave />
      <div class="h-screen w-screen relative flex flex-col z-10">
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

      <Toaster />
    </>
  );
}

export default Home;

