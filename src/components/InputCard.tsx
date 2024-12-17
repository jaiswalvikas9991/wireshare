import { Component } from "solid-js";
import FileAddSvg from "./FileAddSvg";

type InputCardProps = {
  onFilesAdded: (files: File[]) => unknown
};
const InputCard: Component<InputCardProps> = (props) => {
  type OnFileAddedEvent = Event & {
    currentTarget: HTMLInputElement;
    target: Element;
  }
  const onFilesAdded = (e: OnFileAddedEvent) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) {
      return;
    } 
    onMoreFilsAdded(files);
  };

  const onDropHandler = (e) => {
    e.preventDefault();
    const droppedFiles = e.dataTransfer.files;
    if(!droppedFiles || droppedFiles.length === 0) {
      return;
    }
    onMoreFilsAdded(droppedFiles);
  };

  const onMoreFilsAdded = (files: FileList) => {
    const fileList = new Array<File>();
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) fileList.push(file);
    }
    props.onFilesAdded(fileList);
  };

  return (
    <div ondragover={e => e.preventDefault()} ondrop={onDropHandler} class="w-full p-4 bg-base-100 rounded-lg shadow-xl">
      <input
        id="file-upload"
        name="file-upload"
        type="file"
        multiple={true}
        class="sr-only"
        onchange={onFilesAdded}
      />
      <label id="random-id-3" for="file-upload" class="cursor-pointer rounded-md hover:opacity-60">
        <div
          class="flex justify-center px-6 pt-5 pb-6 border-2 border-primary-content text-primary-focus border-dashed rounded-xl bg-base-100"
        >
          <div class="space-y-1 text-center">
            <FileAddSvg />
            <div class="flex text-sm">
              <span class="text-sm font-semibold">Upload a file</span>
            </div>
          </div>
        </div>
      </label>
    </div>
  );
};

export default InputCard;
