import { filesPausedToBeReceivedSignal, filesPausedToBeSentSignal, filesQueuedToBeSentSignal, receivedBytesSignal, receivedFilesSignal, receivingFileInfoSignal, sendingFileInfoSignal, sentBytesSignal, sentFilesSignal } from "$src/stores/files";
import { Component, Show, createSignal } from "solid-js";
import { globalState } from "$src/GlobalState";
import { panic } from "$src/lib/utils/Error";
import SendingCard from "./SendingCard";
import FilesQueuedToBeSentCards from "./FilesQueuedToBeSentCards";
import SentFileCard from "./SentFileCard";
import FilePausedToBeSentCard from "./FilePausedToBeSentCard";
import ReceivingFileInfoCard from "./ReceivingFileInfoCard";
import ReceivedFilesCard from "./ReceivedFilesCard";
import FilePausedToBeReceivedCard from "./FilePausedToBeReceivedCard";
import { triggerFileSent } from "$src/Common";

const NotificationCard: Component = () => {
  const [activeTab, setActiveTab] = createSignal<number>(0);

  const [sendingFileInfo] = sendingFileInfoSignal;
  const [sentFiles, setSentFiles] = sentFilesSignal;
  const [sentBytes] = sentBytesSignal;
  const [filesQueuedToBeSent, setFilesQueuedToBeSent] = filesQueuedToBeSentSignal;
  const [filesPausedToBeSent, setFilesPausedToBeSent] = filesPausedToBeSentSignal;

  const [receivingFileInfo] = receivingFileInfoSignal;
  const [receivedFiles, setReceivedFiles] = receivedFilesSignal;
  const [receivedBytes] = receivedBytesSignal;
  const [filesPausedToBeReceived, setFilesPausedToBeReceived] = filesPausedToBeReceivedSignal;


  const Fallback = () => {
    return (
      <div class="p-1">
        <div class="flex justify-center p-3 border-2 border-gray-300 border-dashed rounded-md w-full">
          No Files To Show
        </div>
      </div>
    );
  };


  const onSendingFilePause = () => {
    if (globalState.machine === null) return panic();
    globalState.machine.pauseSendingFile();
  };

  const onFileDeleteFromToBeSentQueue = (fileName: string) => {
    setFilesQueuedToBeSent(cur => cur.filter(e => e.file.name !== fileName));
  };

  const onSentFileDelete = (filename: string) => {
    if (globalState.localStorage === null) return;
    globalState.localStorage.deleteSendingFileBy(filename);
    setSentFiles(cur => cur.filter(e => e.filename !== filename));
  };

  const onFilesPausedToBeReceivedDelete = (filename: string) => {
    if (globalState.localStorage === null) return;
    globalState.localStorage.deleteReceivingFileBy(filename);
    setFilesPausedToBeReceived(cur => cur.filter(e => e.name !== filename));
  };


  const onFilesPausedToBeSentDelete = (filename: string) => {
    if (globalState.localStorage === null) return;
    globalState.localStorage.deleteSendingFileBy(filename);
    setFilesPausedToBeSent(cur => cur.filter(e => e.file.name !== filename));
  };

  const onFilesPausedToBeSentRequeued = (filename: string) => {
    const [filesPausedToBeSent, setFilesPausedToBeSent] = filesPausedToBeSentSignal;
    const [_f, setFilesQueuedToBeSent] = filesQueuedToBeSentSignal;

    const file = filesPausedToBeSent().find(e => e.file.name === filename);
    if (!file) return panic();
    setFilesPausedToBeSent(cur => cur.filter(e => e.file.name !== file.file.name));
    setFilesQueuedToBeSent(cur => [...cur, { file: file.file }]);

    triggerFileSent();
  };

  const onReceivingFilePause = () => {
    if (globalState.machine === null) return panic();
    globalState.machine.pauseReceivingFile();
  };

  const onReceivedFileDelete = (filename: string) => {
    if (globalState.localStorage === null) return;
    globalState.localStorage.deleteReceivingFileBy(filename);
    setReceivedFiles(cur => cur.filter(e => e.filename !== filename));
  };


  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };
  const handleDownlaodFile = async (filename: string) => {
    if (!globalState.localStorage) return panic();
    const chunks = await globalState.localStorage.getAllSplitsBy(filename);
    downloadBlob(new Blob(chunks), filename);
  };


  return (
    <>
      <div class="tabs tabs-boxed">
        <span
          onclick={() => (setActiveTab(0))}
          class={'tab tab-lg flex-1 ' + (activeTab() === 0 ? 'tab-active' : '')}>Sent Files</span
        >

        <span
          onclick={() => (setActiveTab(1))}
          class={'tab tab-lg flex-1 ' + (activeTab() === 1 ? 'tab-active' : '')}>Received Files</span
        >
      </div>

      <Show when={activeTab() === 0}>
        <Show when={sendingFileInfo() !== null || sentFiles().length > 0 || filesQueuedToBeSent().length || filesPausedToBeSent().length} fallback={<Fallback />}>

          <ul
            class="bg-base-100 w-full h-min max-h-48 p-2 rounded-box overflow-y-scroll overflow-x-hidden no-scrollbar"
          >

            <Show when={sendingFileInfo() !== null}>
              <SendingCard sentBytes={sentBytes()} sendingFileInfo={sendingFileInfo()!} onSendingFilePause={onSendingFilePause} />
            </Show>


            <Show when={filesQueuedToBeSent().length > 0}>
              <FilesQueuedToBeSentCards
                filesQueuedToBeSent={filesQueuedToBeSent()}
                onDelete={onFileDeleteFromToBeSentQueue}
              />
            </Show>

            <Show when={sentFiles().length > 0}>
              <SentFileCard sentFiles={sentFiles()} onDelete={onSentFileDelete} />
            </Show>

            <Show when={filesPausedToBeSent().length > 0}>
              <FilePausedToBeSentCard files={filesPausedToBeSent()!} onDelete={onFilesPausedToBeSentDelete} onRequeued={onFilesPausedToBeSentRequeued} />
            </Show>
          </ul>
        </Show>
      </Show>

      <Show when={activeTab() === 1}>
        <Show when={receivingFileInfo() || receivedFiles().length > 0 || filesPausedToBeReceived().length > 0} fallback={<Fallback />}>
          <ul
            class="bg-base-100 w-full h-min max-h-48 p-2 rounded-box overflow-y-scroll overflow-x-hidden no-scrollbar"
          >
            <Show when={receivingFileInfo()}>
              <ReceivingFileInfoCard receivingFileInfo={receivingFileInfo()!} onPause={onReceivingFilePause} receivedBytes={receivedBytes()} />
            </Show>

          </ul>
        </Show>

        <Show when={receivedFiles().length > 0}>
          <ReceivedFilesCard receivedFiles={receivedFiles()} onSave={handleDownlaodFile} onDelete={onReceivedFileDelete} />
        </Show>


        <Show when={filesPausedToBeReceived().length > 0}>
          <FilePausedToBeReceivedCard files={filesPausedToBeReceived()} onDelete={onFilesPausedToBeReceivedDelete} />
        </Show>
      </Show>
    </>
  );
};


export default NotificationCard;
