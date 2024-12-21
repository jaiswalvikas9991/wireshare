import { PausedToBeSentFiles } from "$src/lib/models/types";
import { Component, For, Show } from "solid-js";
import TrashSvg from "./TrashSvg";
import ReloadSvg from "./ReloadSvg";
import peerIdSignal from "$src/stores/peer";
import { formatBytesHumanReadable } from "$src/Common";

type FilePausedToBeSentCardProps = {
  files: PausedToBeSentFiles[],
  onDelete: (filename: string) => unknown,
  onRequeued: (filename: string) => unknown
}
const FilePausedToBeSentCard: Component<FilePausedToBeSentCardProps> = (props) => {
  const [peerId] = peerIdSignal;

  return (
    <>
      <div class="divider flex-1">Incomplete</div>
      <For each={props.files}>
        {(file, _idx) =>
          <div class="card flex-1">
            <div class="card-body flex-1 flex flex-row items-center p-1">
              <li id={file.file.name} class="flex flex-row items-center flex-1">
                <div class="flex-1 flex flex-row">
                  <h2 class="flex-1 font-semibold break-all">{file.file.name}</h2>
                  <h2>{formatBytesHumanReadable(file.file.size)}</h2>
                </div>

                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={() => props.onDelete(file.file.name)}
                >
                  <TrashSvg />
                </span>

                <Show when={peerId() !== null}>
                <span
                  class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent"
                  onclick={() => props.onRequeued(file.file.name)}
                >
                  <ReloadSvg />
                </span>
                </Show>
              </li>
            </div>
          </div>
        }
      </For>
    </>
  );
};

export default FilePausedToBeSentCard;
