import { Component, Show, createSignal } from "solid-js";
import CrossSvg from "./CrossSvg";

type PeerSearchProps = {
  userId: string,
  onclick: (peerId: string) => unknown
}
const PeerSearch: Component<PeerSearchProps> = (props) => {
  const [text, setText] = createSignal<string>('');
  const [errorText, setErrorText] = createSignal<string | null>(null);

  const onclick = () => {
    const peerId = text();
    setErrorText(null);
    if (peerId.length === 0) {
      setErrorText('PeerId cannot be emtpy');
      return;
    }
    if (peerId === props.userId) {
      setErrorText('You cannot connect to yourself');
      return;
    }

    props.onclick(peerId);
  };

  return (
    <div class="flex flex-col p-5 w-96 bg-neutral rounded-box">
      <input
        type="text"
        placeholder="Enter PeerId"
        class="input input-bordered input-primary input-md mb-3"
        value={text()}
        onkeyup={e => setText(e.currentTarget.value)}
      />
      <button onclick={onclick} class="btn btn-primary">Connect</button>
      <Show when={errorText() !== null}>
        <div class="flex flex-row mt-3">
          <div class="text-error"><CrossSvg /></div>
          <h1 class="text-error">{errorText()}</h1>
        </div>
      </Show>
    </div>
  );
};

export default PeerSearch;
