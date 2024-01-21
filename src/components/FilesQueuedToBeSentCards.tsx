import { ToBeSentFile } from "$src/lib/models/types";
import { Component, For } from "solid-js";
import TrashSvg from "./TrashSvg";

type FilesQueuedToBeSentCardsProps = {
  filesQueuedToBeSent: ToBeSentFile[]
  onDelete: (name: string) => unknown
}

const FilesQueuedToBeSentCards: Component<FilesQueuedToBeSentCardsProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Queued</div>
      <For each={props.filesQueuedToBeSent}>
        {(file, _idx) =>
          <div class="card flex-1">
            <div class="card-body flex-1 flex flex-row items-center p-1">
              <li id={file.file.name} class="flex flex-row items-center flex-1">
                <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{file.file.name}</h2>
                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={_e => props.onDelete(file.file.name)}
                >
                  <TrashSvg />
                </span>
              </li>
            </div>
          </div>
        }
      </For>
    </>
  );
};

export default FilesQueuedToBeSentCards;
