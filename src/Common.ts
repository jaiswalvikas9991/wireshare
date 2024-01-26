import { globalState } from "./GlobalState";
import { States } from "./lib/impls/Machine";
import { panic } from "./lib/utils/Error";
import { filesQueuedToBeSentSignal, sendingFileInfoSignal } from "./stores/files";

const triggerNextFileSent = () => {
  if (!globalState.machine) return panic();
  const [toBeSentFiles, _stbs] = filesQueuedToBeSentSignal;

  const toBeQueued = toBeSentFiles().at(0);
  if (!toBeQueued) return panic();

  globalState.machine.sendFile(toBeQueued.file);
};


export const triggerFileSent = () => {
  if(globalState.machine === null) return;
  if(globalState.machine.state() !== States.CONNECTED) return;
  // This means something need to be queued
  const [toBeSentFiles] = filesQueuedToBeSentSignal;
  const [sendingFileInfo] = sendingFileInfoSignal;

  if (sendingFileInfo() !== null || toBeSentFiles().length <= 0) return;
  triggerNextFileSent();
};


const fallbackCopyTextToClipboard = (text: string) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  // Avoid scrolling to bottom
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.position = 'fixed';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const successful = document.execCommand('copy');
  if (!successful) throw new Error('Copying Failed');
  document.body.removeChild(textArea);
};

export const copyTextToClipboard = async (text: string) => {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  return await navigator.clipboard.writeText(text);
};

