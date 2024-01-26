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
    if (!files) return;
    const fileList = new Array<File>();
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) fileList.push(file);
    }
    props.onFilesAdded(fileList);
  };

  return (
    <>
      <input
        id="file-upload"
        name="file-upload"
        type="file"
        multiple={true}
        class="sr-only"
        onchange={onFilesAdded}
      />
      <label id="random-id-3" for="file-upload" class="cursor-pointer rounded-md hover:opacity-50">
        <div
          class="flex justify-center px-6 pt-5 pb-6 border-2 text-primary-content border-dashed rounded-md"
        >
          <div class="space-y-1 text-center">
            <FileAddSvg />
            <div class="flex text-sm text-primary-content">
              <span class="text-sm">Upload a file</span>
            </div>
          </div>
        </div>
      </label>
    </>
  );
};

export default InputCard;
