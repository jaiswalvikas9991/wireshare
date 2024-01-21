import { Component } from "solid-js";

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
    <div
      class="flex justify-center px-6 pt-5 pb-6 border-2 text-primary-content border-dashed rounded-md w-full"
    >
      <div class="space-y-1 text-center">
        <svg
          class="mx-auto h-12 w-12 text-primary-content"
          stroke="currentColor"
          fill="none"
          viewBox="0 0 48 48"
          aria-hidden="true"
        >
          <path
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <div class="flex text-sm text-primary-content">
          <label for="file-upload" class="cursor-pointer rounded-md">
            <span class="bg-base-300 btn-xs rounded-md">Upload a file</span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              multiple={true}
              class="sr-only"
              onchange={onFilesAdded}
            />
          </label>
          <p class="pl-1">or drag and drop</p>
        </div>
      </div>
    </div>
  );
};

export default InputCard;
