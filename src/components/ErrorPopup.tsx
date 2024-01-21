import { Component } from "solid-js";

type ErrorPopup = {
  msg: string | null,
  onclose: () => unknown
}
const ErrorPopup: Component<ErrorPopup> = (props) => {
  return (
    <>
      <input type="checkbox" id="message-modal" class="modal-toggle" checked={props.msg !== null} />
      <div class="modal">
        <div class="modal-box relative">
          <span class="btn btn-sm btn-circle absolute right-2 top-2" onclick={props.onclose}>✕</span>
          <h3 class="text-lg font-bold">Oops!!! Something went wrong</h3>
          <p class="py-4">
            {props.msg}
          </p>
        </div>
      </div>
    </>
  );
};

export default ErrorPopup;
