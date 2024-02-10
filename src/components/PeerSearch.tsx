import { Component, Show, createSignal } from "solid-js";
import CrossSvg from "./CrossSvg";



type ChangeEvent = Event & {
  currentTarget: HTMLInputElement;
  target: HTMLInputElement;
}
type PasteEvent = ClipboardEvent & {
  currentTarget: HTMLInputElement;
  target: Element;
}
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

  const handleChange = (e: ChangeEvent) => {
    const cur = e.currentTarget.value.toLowerCase();
    if (cur === text()) return;
    setText(cur)
  };

  return (
    <div class="flex flex-col p-5 2xl:w-1/4 lg:w-5/12 md:w-2/3 w-9/12 bg-base-100 rounded-box shadow-lg">
      <input
        type="text"
        placeholder="Enter PeerId"
        class="input input-bordered input-primary input-md mb-3"
        value={text()}
        oninput={handleChange}
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
