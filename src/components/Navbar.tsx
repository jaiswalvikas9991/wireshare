import { Component } from "solid-js";
import RocketSvg from "./RocketSvg";
import { APP_NAME, VERSION } from "$src/Constants";
import NotificationCard from "./NotificationCard";

const Navbar: Component = () => {
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
      <div class="navbar-end h-full flex-1 flex-row justify-end items-center">
        <label id="random-id-4" for="notification-label" class="btn btn-outline btn-sm">
          Transfers
        </label>

        <input type="checkbox" id="notification-label" class="modal-toggle" />
        <div class="modal" role="dialog">
          <div class="modal-box p-2">
            <NotificationCard />
          </div>
          <label id="random-id-05" class="modal-backdrop" for="notification-label">Close</label>
        </div>
      </div>
    </div >
  );
};

export default Navbar;
