const flowError = () => {
  throw new Error("This path should be prohibited");
};

/**
 * Use this only when the error must be notified to the client
*/
const panic = (msg: string = "Something went wrong, Refresh and try again") => {
  throw new Error(msg);
};

export { flowError, panic };
