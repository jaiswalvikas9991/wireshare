import { PausedToBeSentFiles } from "$src/lib/models/types";
import { Component, For } from "solid-js";
import TrashSvg from "./TrashSvg";

type FilePausedToBeSentCardProps = {
  files: PausedToBeSentFiles[],
  onDelete: (filename: string) => unknown
}
const FilePausedToBeSentCard: Component<FilePausedToBeSentCardProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Paused</div>
      <For each={props.files}>
        {(file, _idx) =>
          <div class="card flex-1">
            <div class="card-body flex-1 flex flex-row items-center p-1">
              <li id={file.file.name} class="flex flex-row items-center flex-1">
                <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{file.file.name}</h2>
                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={() => props.onDelete(file.file.name)}
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

export default FilePausedToBeSentCard;
