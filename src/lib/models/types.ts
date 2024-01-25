export type UserId = string;

// Sends
export type ToBeSentFile = {
    file: File
};

export type PausedToBeSentFiles = {
    file: File,
    // alreadySent: number
};

export type SentFile = {
    filename: string,
    size: number
}


// Receives
export type ToBeReceivedFile = {
    name: string,
    size: number,
};

export type PausedToBeReceivedFile = {
    name: string,
    size: number,
    alreadyReceived: number
};

export type ReceivedFile = {
    filename: string,
    size: number
}

