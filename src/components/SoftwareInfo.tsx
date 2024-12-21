import { APP_NAME } from "$src/Constants";
import { Component } from "solid-js";

type SoftwareInfoProps = {
  show: boolean 
  onclose: () => unknown
}
const SoftwareInfo: Component<SoftwareInfoProps> = (props) => {
  return (
    <>
      <input type="checkbox" id="message-modal" class="modal-toggle" checked={props.show} />
      <div class="modal">
        <div class="modal-box relative">
          <span class="btn btn-sm btn-circle absolute right-2 top-2" onclick={props.onclose}>✕</span>
          <h3 class="text-lg font-bold">Hi! Thanks for trying <span class="text-primary">{APP_NAME}</span></h3>
          <ul class="list-disc pl-4">
            <li>If you're unable to connect to a peer, try asking the other peer to initiate the connection. This might work in some cases.</li>
            <li>Please delete the received file from transfers after downloading it to prevent it from occupying unnecessary space in the browser's memory.</li>
            <li>This is BETA software, so some issues may occur.</li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default SoftwareInfo;
