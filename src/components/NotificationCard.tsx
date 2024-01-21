import { ReceivedFile, SentFile, ToBeReceivedFile, ToBeSentFile } from "$src/lib/models/types";
import { filesQueuedToBeSentSignal, receivedBytesSignal, receivedFilesSignal, receivingFileInfoSignal, sendingFileInfoSignal, sentBytesSignal, sentFilesSignal } from "$src/stores/files";
import { Component, For, Show, createSignal } from "solid-js";

const NotificationCard: Component = () => {
  const [activeTab, setActiveTab] = createSignal<number>(0);

  const [sendingFileInfo] = sendingFileInfoSignal;
  const [sentFiles] = sentFilesSignal;
  const [sentBytes] = sentBytesSignal;
  const [filesQueuedToBeSent, _fqts] = filesQueuedToBeSentSignal;

  const [receivingFileInfo] = receivingFileInfoSignal;
  const [receivedFiles] = receivedFilesSignal;
  const [receivedBytes] = receivedBytesSignal;


  const Fallback = () => {
    return (
      <div class="p-1">
        <div class="flex justify-center p-3 border-2 border-gray-300 border-dashed rounded-md w-full">
          No Files To Show
        </div>
      </div>
    );
  };


  const SendingCard = (sendingFileInfo: ToBeSentFile) => {
    return (
      <>
        <div class="divider flex-1">Sending</div>
        <div class="card flex-1">
          <div class="card-body flex-1 flex flex-row items-center p-1">
            <li id={sendingFileInfo.file.name} class="flex flex-row items-center flex-1">
              <div class="flex flex-col flex-1 items-start">
                <h2 class="flex-1 text-ellipsis break-all cursor-pointer">
                  {sendingFileInfo.file.name}
                </h2>
                <progress
                  class="progress progress-primary w-full bg-neutral"
                  value={100 * (sentBytes() / sendingFileInfo.file.size)}
                  max="100"
                />
              </div>
              <span
                class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                onclick={
                () => {}
                  // () => sendingFileInfo && onSendingFileCancel(sendingFileInfo.uuid)
                }
              >
                <svg
                  class="fill-current"
                  xmlns="http://www.w3.org/2000/svg"
                  width="25"
                  height="25"
                  viewBox="0 0 512 512"
                ><polygon
                    points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49"
                  /></svg
                >
              </span>

              <span
                class="btn btn-circle btn-outline btn-primary cursor-pointer border-transparent"
                onclick={
                () => {}
                  // () => sendingFileInfo && onSendingFilePause(sendingFileInfo.uuid)
                }
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="icon icon-tabler icon-tabler-player-pause"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  fill="none"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </span>
            </li>
          </div>
        </div>
      </>
    );
  };

  const FilesQueuedToBeSentCards = (filesQueuedToBeSent: ToBeSentFile[]) => {
    return (
      <>
        <div class="divider flex-1">
          <p>Pending</p>
          <span
            class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent"
            onclick={
                () => {}
              // onRefreshSending
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="icon icon-tabler icon-tabler-rotate"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <path d="M19.95 11a8 8 0 1 0 -.5 4m.5 5v-5h-5" />
            </svg>
          </span>
        </div>
        <For each={filesQueuedToBeSent}>
          {(file, _idx) =>
            <div class="card flex-1">
              <div class="card-body flex-1 flex flex-row items-center p-1">
                <li id={file.file.name} class="flex flex-row items-center flex-1">
                  <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{file.file.name}</h2>
                  <span
                    class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                    onclick={() => {
                      // onSendingFileDbDelete(file.uuid);
                      // onQueuedFileCancel(file.uuid);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="icon icon-tabler icon-tabler-trash"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                      stroke="currentColor"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <line x1="4" y1="7" x2="20" y2="7" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                    </svg>
                  </span>
                  <span
                    class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                    onclick={
                () => {}
                      // () => onQueuedFileCancel(file.uuid)
                    }
                  >
                    <svg
                      class="fill-current"
                      xmlns="http://www.w3.org/2000/svg"
                      width="25"
                      height="25"
                      viewBox="0 0 512 512"
                    ><polygon
                        points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49"
                      /></svg
                    >
                  </span>
                </li>
              </div>
            </div>
          }
        </For>
      </>
    );
  };

  const SentFileCard = (sentFiles: SentFile[]) => {
    return (
      <>
        <div class="divider flex-1">Completed</div>
        <For each={sentFiles}>
          {(file, _idx) =>
            <div class="card flex-1">
              <div class="card-body flex-1 flex flex-row items-center p-1">
                <li id={file.filename} class="flex flex-row items-center flex-1">
                  <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{file.filename}</h2>

                  <span
                    class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                    onclick={() => {
                      // onSendingFileDbDelete(file.uuid);
                      // onSentFileCancel(file.uuid);
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="icon icon-tabler icon-tabler-trash"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      stroke-width="2"
                      stroke="currentColor"
                      fill="none"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                      <line x1="4" y1="7" x2="20" y2="7" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                      <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                      <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                    </svg>
                  </span>

                  <span
                    class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                    onclick={
                () => {}
                      // () => onSentFileCancel(file.uuid)
                    }
                  >
                    <svg
                      class="fill-current"
                      xmlns="http://www.w3.org/2000/svg"
                      width="25"
                      height="25"
                      viewBox="0 0 512 512"
                    ><polygon
                        points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49"
                      /></svg
                    >
                  </span>
                </li>
              </div>
            </div>
          }
        </For>
      </>
    );
  };

  const ReceivingFileInfoCard = (toBeReceivedFile: ToBeReceivedFile) => {
    return (
      <>
        <div class="divider flex-1">Receiving</div>
        <li id={toBeReceivedFile.name} class="flex flex-row items-center flex-1">
          <div class="flex flex-col flex-1 items-start">
            <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{receivingFileInfo.name}</h2>
            <progress
              class="progress progress-primary w-full bg-neutral"
              value={100 * (receivedBytes() / toBeReceivedFile.size)}
              max="100"
            />
          </div>
          <span
            class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
            onclick={
                () => {}
              // () => receivingFileInfo && onReceivingFileCancel(receivingFileInfo.uuid)
            }
          >
            <svg
              class="fill-current"
              xmlns="http://www.w3.org/2000/svg"
              width="25"
              height="25"
              viewBox="0 0 512 512"
            ><polygon
                points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49"
              /></svg
            >
          </span>

          <span
            class="btn btn-circle btn-outline btn-primary cursor-pointer border-transparent"
            onclick={
                () => {}
              // () => receivingFileInfo && onReceivingFilePause(receivingFileInfo.uuid)
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="icon icon-tabler icon-tabler-player-pause"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path stroke="none" d="M0 0h24v24H0z" fill="none" />
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </span>
        </li>
      </>
    );
  };

  const ReceivedFilesCard = (receivedFiles: ReceivedFile[]) => {
    return (
      <>
        <div class="divider flex-1">Completed</div>
        <For each={receivedFiles}>
          {(file, _idx) =>
            <li id={file.filename} class="card flex-1">
              <div class="card-body flex-1 flex flex-row items-center p-1">
                <h2 class="text-ellipsis break-all cursor-pointer flex-1">{file.filename}</h2>
                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={() => {
                () => {}
                    // onReceivingFileDbDelete(file.uuid);
                    // onReceivedFileCancel(file.uuid);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="icon icon-tabler icon-tabler-trash"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <line x1="4" y1="7" x2="20" y2="7" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" />
                    <path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                  </svg>
                </span>
                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={
                () => {}
                    // () => onReceivedFileCancel(file.uuid)
                  }
                >
                  <svg
                    class="fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    width="25"
                    height="25"
                    viewBox="0 0 512 512"
                  ><polygon
                      points="400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49"
                    /></svg
                  >
                </span>
                <span
                  class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent"
                  onclick={
                () => {}
                    // () => onSaveReceivedFile(file.uuid, file.name)
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="icon icon-tabler icon-tabler-file-download"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                    <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                    <path
                      d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"
                    />
                    <path d="M12 17v-6" />
                    <path d="M9.5 14.5l2.5 2.5l2.5 -2.5" />
                  </svg>
                </span>
              </div>
            </li>
          }
        </For>
      </>
    );
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
        <Show when={sendingFileInfo() || sentFiles().length > 0 || filesQueuedToBeSent().length} fallback={<Fallback />}>

          <ul
            class="bg-base-100 w-full h-min max-h-48 p-2 rounded-box overflow-y-scroll overflow-x-hidden no-scrollbar"
          >

            <Show when={sendingFileInfo()}>
              {SendingCard(sendingFileInfo()!)}
            </Show>


            <Show when={filesQueuedToBeSent().length > 0}>
              {FilesQueuedToBeSentCards(filesQueuedToBeSent())}
            </Show>

            <Show when={sentFiles().length > 0}>
              {SentFileCard(sentFiles())}
            </Show>
          </ul>
        </Show>
      </Show>

      <Show when={activeTab() === 1}>
        <Show when={receivingFileInfo() || receivedFiles().length > 0} fallback={<Fallback />}>
          <ul
            class="bg-base-100 w-full h-min max-h-48 p-2 rounded-box overflow-y-scroll overflow-x-hidden no-scrollbar"
          >
            <Show when={receivingFileInfo()}>
              {ReceivingFileInfoCard(receivingFileInfo()!)}
            </Show>

          </ul>
        </Show>

        <Show when={receivedFiles().length > 0}>
          {ReceivedFilesCard(receivedFiles())}
        </Show>
      </Show>
    </>
  );
};


export default NotificationCard;
