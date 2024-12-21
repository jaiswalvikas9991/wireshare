import { PausedToBeReceivedFile } from "$src/lib/models/types";
import { Component, For } from "solid-js";
import TrashSvg from "./TrashSvg";
import { formatBytesHumanReadable } from "$src/Common";

type FilePausedToBeReceivedCardProps = {
  files: PausedToBeReceivedFile[],
  onDelete: (filename: string) => unknown
}
const FilePausedToBeReceivedCard: Component<FilePausedToBeReceivedCardProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Incomplete</div>
      <For each={props.files}>
        {(file, _idx) =>
          <div class="card flex-1">
            <div class="card-body flex-1 flex flex-row items-center p-1">
              <li id={file.name} class="flex flex-row items-center flex-1">
                <div class="flex flex-col flex-1 items-start">
                  <div class="flex flex-row w-full">
                    <h2 class="flex-1 font-semibold break-all">{file.name}</h2>
                    <h2>{formatBytesHumanReadable(file.alreadyReceived)}/{formatBytesHumanReadable(file.size)}</h2>
                  </div>
                  <progress
                    class="progress progress-primary w-full bg-base-300"
                    value={100 * (file.alreadyReceived / file.size)}
                    max="100"
                  />
                </div>
                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={() => props.onDelete(file.name)}
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

export default FilePausedToBeReceivedCard;
