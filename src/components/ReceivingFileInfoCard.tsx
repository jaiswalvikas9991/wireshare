import { ToBeReceivedFile } from "$src/lib/models/types";
import { Component } from "solid-js";
import PauseSvg from "./PauseSvg";
import { formatBytesHumanReadable } from "$src/Common";


type ReceivingFileInfoCardProps = {
  receivingFileInfo: ToBeReceivedFile,
  receivedBytes: number,
  onPause: () => unknown
}
const ReceivingFileInfoCard: Component<ReceivingFileInfoCardProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Receiving</div>
      <li id={props.receivingFileInfo.name} class="flex flex-row items-center flex-1">
        <div class="flex flex-col flex-1 items-start">
          <div class="flex flex-row w-full">
            <h2 class="flex-1 font-semibold break-all">{props.receivingFileInfo.name}</h2>
            <h2>{formatBytesHumanReadable(props.receivedBytes)}/{formatBytesHumanReadable(props.receivingFileInfo.size)}</h2>
          </div>

          <progress
            class="progress progress-primary w-full bg-base-300"
            value={100 * (props.receivedBytes / props.receivingFileInfo.size)}
            max="100"
          />
        </div>

        <span
          class="btn btn-circle btn-outline btn-primary cursor-pointer border-transparent"
          onclick={props.onPause}
        >
          <PauseSvg />
        </span>
      </li>
    </>
  );
};

export default ReceivingFileInfoCard;
