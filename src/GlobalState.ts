import { LocalStorage } from "./lib/impls/DexieDb";
import Machine from "./lib/impls/Machine";

type GlobalState = {
  machine: Machine | null,
  localStorage: LocalStorage | null
}

const globalState: GlobalState = {
  machine: null,
  localStorage: null
};

export { globalState };
