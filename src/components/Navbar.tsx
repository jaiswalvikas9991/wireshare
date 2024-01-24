import { Component, Show } from "solid-js";
import RocketSvg from "./RocketSvg";
import { APP_NAME, VERSION } from "$src/Constants";
import BellSvg from "./BellSvg";
import NotificationCard from "./NotificationCard";
import { receivingFileInfoSignal, sendingFileInfoSignal } from "$src/stores/files";

const Navbar: Component = () => {
  const [sendingFileInfo] = sendingFileInfoSignal;
  const [receivingFileInfo] = receivingFileInfoSignal;

  return (
    <div class="navbar bg-base-100">
      <div class="navbar-start">
        <span class="flex flex-row items-start">
          <div class="pt-3">
            <RocketSvg />
          </div>
          <div class="flex flex-col p-2">
            <strong class="normal-case text-xl md:text-2xl">{APP_NAME}</strong>
            <p class="font-semibold pb-2 text-xs md:text-sm text-success">
              {VERSION}
            </p>
          </div>
        </span>
      </div>
      <div class="navbar-end">
        <label for="notification-label" class="btn btn-ghost btn-circle">
          <div class="indicator">
            <BellSvg />
            <Show when={sendingFileInfo() || receivingFileInfo()}>
              <span class="badge badge-xs badge-primary indicator-item" />
            </Show>
          </div>
        </label>

        <input type="checkbox" id="notification-label" class="modal-toggle" />
        <div class="modal" role="dialog">
          <div class="modal-box p-2">
            <NotificationCard />
          </div>
          <label class="modal-backdrop" for="notification-label">Close</label>
        </div>


      </div>
    </div >
  );
};

export default Navbar;
