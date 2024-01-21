import { SentFile } from "$src/lib/models/types";
import { Component, For } from "solid-js";
import TrashSvg from "./TrashSvg";

type SentFileCardProps = {
  sentFiles: SentFile[],
  onDelete: (filename: string) => unknown
}
const SentFileCard: Component<SentFileCardProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Completed</div>
      <For each={props.sentFiles}>
        {(file, _idx) =>
          <div class="card flex-1">
            <div class="card-body flex-1 flex flex-row items-center p-1">
              <li id={file.filename} class="flex flex-row items-center flex-1">
                <h2 class="flex-1 text-ellipsis break-all cursor-pointer">{file.filename}</h2>
                <span
                  class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                  onclick={() => props.onDelete(file.filename)}
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

export default SentFileCard;
