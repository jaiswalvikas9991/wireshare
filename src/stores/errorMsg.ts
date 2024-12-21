import { createSignal } from "solid-js";

const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

const showErrorToUser = (error: string | null) => {
  if(error === null) {
    setErrorMsg(null);
    return;
  }
  setErrorMsg(e => (e === null ? '' : e) + '\n' + error);
};

export default [ errorMsg, showErrorToUser ] as [typeof errorMsg, typeof showErrorToUser];
