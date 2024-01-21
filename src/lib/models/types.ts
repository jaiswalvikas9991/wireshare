type RoomId = string;
type UserId = string;

// Sends
type ToBeSentFile = {
    file: File
};

type SentFile = {
    filename: string,
    size: number
}


// Receives
type ToBeReceivedFile = {
    name: string,
    size: number,
};

type ReceivedFile = {
    filename: string,
    size: number
}

export type { RoomId, UserId, ToBeSentFile, ToBeReceivedFile, SentFile, ReceivedFile };
