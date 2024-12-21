export const flowError = (why: string) => {
  throw new Error(`This path should be prohibited ${why}`);
};

export const invariantViolation = (why: string) => {
  throw new Error(`This condition is not expected to fail ${why}`);
};

/**
 * Use this only when the error must be notified to the client
*/
const panic = (msg: string = "Something went wrong, Refresh and try again") => {
  throw new Error(msg);
};
