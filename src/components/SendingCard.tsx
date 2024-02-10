import { Component } from "solid-js";
import PauseSvg from "./PauseSvg";
import { ToBeSentFile } from "$src/lib/models/types";

type SendingCardProps = {
  sendingFileInfo: ToBeSentFile,
  sentBytes: number,
  onSendingFilePause: () => unknown
}
const SendingCard: Component<SendingCardProps> = (props) => {
  return (
    <>
      <div class="divider flex-1">Sending</div>
      <div class="card flex-1">
        <div class="card-body flex-1 flex flex-row items-center p-1">
          <li id={props.sendingFileInfo.file.name} class="flex flex-row items-center flex-1">
            <div class="flex flex-col flex-1 items-start">
              <h2 class="flex-1 text-ellipsis break-all cursor-pointer">
                {props.sendingFileInfo.file.name}
              </h2>
              <progress
                class="progress progress-primary w-full bg-base-300"
                value={100 * (props.sentBytes / props.sendingFileInfo.file.size)}
                max="100"
              />
            </div>

            <span
              class="btn btn-circle btn-outline btn-primary cursor-pointer border-transparent"
              onclick={props.onSendingFilePause}
            >
              <PauseSvg />
            </span>
          </li>
        </div>
      </div>
    </>
  );
};


export default SendingCard;
