import { ReceivedFile } from "$src/lib/models/types";
import { Component, For } from "solid-js";
import TrashSvg from "./TrashSvg";
import SaveSvg from "./SaveSvg";

type ReceivedFilesCardProps = {
  receivedFiles: ReceivedFile[]
  onDelete: (filename: string) => unknown,
  onSave: (filename: string) => unknown
}
const ReceivedFilesCard: Component<ReceivedFilesCardProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Completed</div>
      <For each={props.receivedFiles}>
        {(file, _idx) =>
          <li id={file.filename} class="card flex-1">
            <div class="card-body flex-1 flex flex-row items-center p-1">
              <h2 class="text-ellipsis break-all cursor-pointer flex-1">{file.filename}</h2>
              <span
                class="btn btn-circle btn-outline btn-error cursor-pointer border-transparent"
                onclick={() => props.onDelete(file.filename)}
              >
                <TrashSvg />
              </span>
              <span
                class="btn btn-circle btn-outline btn-success cursor-pointer border-transparent"
                onclick={() => props.onSave(file.filename)}
              >
                <SaveSvg />
              </span>
            </div>
          </li>
        }
      </For>
    </>
  );
};

export default ReceivedFilesCard;
