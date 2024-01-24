import { globalState } from "./GlobalState";
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
  // This means something need to be queued
  const [toBeSentFiles] = filesQueuedToBeSentSignal;
  const [sendingFileInfo] = sendingFileInfoSignal;

  if (!!sendingFileInfo() || toBeSentFiles().length <= 0) return;
  triggerNextFileSent();
};
