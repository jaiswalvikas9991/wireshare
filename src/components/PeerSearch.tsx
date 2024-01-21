import { Component, createSignal } from "solid-js";

type PeerSearchProps = {
  onclick: (peerId: string) => unknown
}
const PeerSearch: Component<PeerSearchProps> = (props) => {
  const [text, setText] = createSignal<string>('');

  const onclick = () => {
    props.onclick(text());
  };

  return (
    <div class="flex flex-row space-x-1 p-1">
      <input
        type="text"
        placeholder="Search PeerId/PeerName"
        class="input input-bordered input-primary input-md w-full"
        value={text()}
        onkeyup={e => setText(e.currentTarget.value)}
      />
      <button disabled={text().length === 0}
        onclick={onclick} class="btn btn-primary">Connect</button>
    </div>
  );
};

export default PeerSearch;
