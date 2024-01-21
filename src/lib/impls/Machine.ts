import { BlobReader } from "$src/BlobReader";
import ByteArray from "$src/BytesArray";
import { FIXED_FILE_CHUNK_SIZE, MAX_WEBRTC_MSG_SIZE } from "$src/Constants";
import { globalState } from "$src/GlobalState";
import { filesPausedToBeReceivedSignal, filesPausedToBeSentSignal, filesQueuedToBeSentSignal, receivedBytesSignal, receivingFileInfoSignal, sendingFileInfoSignal, sentBytesSignal } from "$src/stores/files";
import peerIdSignal from "$src/stores/peer";
import peerIdsSignal from "$src/stores/peers";
import roomIdSignal from "$src/stores/room";
import userIdSignal from "$src/stores/user";
import { RoomId, UserId } from "../models/types";
import SignallingPort from "../traits/SignallingPort";
import { STUN_SERVERS } from "../utils/Constants";
import { flowError, panic } from "../utils/Error";
import { toBase10, waitFor } from "../utils/utils";

enum States {
    STALE,
    READY,
    CONNECTING,
    CONNECTED,
    SENDING,
    RECEIVING
}

type StaleCtx = {
    type: States.STALE
};


type ReadyCxt = {
    type: States.READY,
    userId: UserId
    roomId: RoomId
};

type ConnectingCtx = {
    type: States.CONNECTING,
    userId: UserId,
    roomId: RoomId,
    peerId: UserId,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel
};

type ConnectedCtx = {
    type: States.CONNECTED,
    userId: UserId,
    roomId: RoomId,
    peerId: UserId,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel
};


type SendingCtx = {
    type: States.SENDING
    userId: UserId,
    roomId: RoomId,
    peerId: UserId,
    sendingFile: File
    negotiatedFileChunkSize: number
    numberOfChunksSent: number,
    sendingFileBlob: BlobReader,
    sentDataInCurrentChunk: number,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel
};

type ReceivingCtx = {
    type: States.RECEIVING
    userId: UserId,
    roomId: RoomId,
    peerId: UserId,
    fileSize: number,
    fileName: string,
    negotiatedFileChunkSize: number,
    numberOfChunksReceived: number,
    receiveBuffer: ByteArray,
    receivedDataInCurrentChunk: number,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel
};

type MachineState = StaleCtx | ReadyCxt | ConnectedCtx | ConnectingCtx | SendingCtx | ReceivingCtx;

const Transitions = {
    [States.STALE]: [States.READY],
    [States.READY]: [States.CONNECTING],
    [States.CONNECTING]: [States.CONNECTED],
    [States.CONNECTED]: [States.SENDING, States.RECEIVING, States.READY, States.STALE],
    [States.SENDING]: [States.CONNECTED, States.READY, States.STALE],
    [States.RECEIVING]: [States.CONNECTED, States.READY, States.STALE],
};

const isTransitionAllowed = (from: States, to: States): boolean => {
    const states = Transitions[from];
    for (let i = 0; i < states.length; ++i) {
        if (states[i] == to) {
            return true;
        }
    }
    return false;
};



enum ReceiveSignallingTypes {
    CONNECTED_TO_SERVER = 0,
    PEERCONNECTED = 1,
    PEERDISCONNECTED = 2,
    OFFER = 3,
    ANSWER = 4
}
type ConnectedToServer = {
    type: ReceiveSignallingTypes.CONNECTED_TO_SERVER,
    userId: UserId
    peerIds: UserId[]
};
type PeerConnected = {
    type: ReceiveSignallingTypes.PEERCONNECTED,
    userId: UserId
};
type PeerDiconnected = {
    type: ReceiveSignallingTypes.PEERDISCONNECTED,
    userId: UserId
};
type Offer = {
    type: ReceiveSignallingTypes.OFFER,
    fromUserId: UserId
    offer: string
};
type Answer = {
    type: ReceiveSignallingTypes.ANSWER,
    fromUserId: UserId
    answer: string
};
type ReceiveSignallingMsg = ConnectedToServer | Offer | Answer | PeerConnected | PeerDiconnected;

type SignallingSendMsg = {
    toUserId: UserId,
    msg: ReceiveSignallingMsg
};

class Machine {
    private currentState: MachineState;
    private signallingAdaptor: SignallingPort;
    private sendingFileRef: File | null = null;

    constructor(signallingAdaptor: SignallingPort) {
        this.currentState = { type: States.STALE };

        this.signallingAdaptor = signallingAdaptor;
        this.signallingAdaptor.onMsg(this.onSignallingMsg.bind(this));
    }


    // TODO: May be can be improved
    calculateNumChunks(fileSize: number, chunkSize: number) {
        return Math.ceil(fileSize / chunkSize);
    }

    calculateChunkSize(chunkNumber: number, totalNumberOfChunks: number, chunkSize: number, fileSize: number) {
        return chunkNumber < totalNumberOfChunks ? Math.min(fileSize, chunkSize) : fileSize - chunkSize * (totalNumberOfChunks - 1);
    }


    async onDataChannelFree(freeSpace: number) {
        if (this.currentState.type === States.CONNECTED) return;
        if (this.currentState.type != States.SENDING) return flowError();
        if (this.currentState.rtcPeerConnection.connectionState !== 'connected') return;
        const currentChunkNumber = this.currentState.numberOfChunksSent + 1;
        const totalNumberOfChunks = this.calculateNumChunks(this.currentState.sendingFile.size, this.currentState.negotiatedFileChunkSize); // This we can put on context
        if (currentChunkNumber > totalNumberOfChunks) return panic('Should be impossible');

        const sizeOfCurrentChunk = this.calculateChunkSize(currentChunkNumber, totalNumberOfChunks, this.currentState.negotiatedFileChunkSize, this.currentState.sendingFile.size);
        if (this.currentState.sentDataInCurrentChunk > sizeOfCurrentChunk) {
            return panic('Should be impossible');
        }

        if (this.currentState.sentDataInCurrentChunk === sizeOfCurrentChunk) {
            return;
        }


        const data = await this.currentState.sendingFileBlob.read(freeSpace);
        this.sendData(data);
        const actualDataSize = data.byteLength - BlobReader.indexSize;
        this.currentState.sentDataInCurrentChunk += actualDataSize; // Need to abstract this better

        onMoreDataSent(actualDataSize);
    }


    sendSignal(msg: SignallingSendMsg) {
        const data = { toUserId: msg.toUserId, msg: JSON.stringify(msg.msg) };
        this.signallingAdaptor.send(JSON.stringify(data));
    }

    async onSignallingMsg(message: string) {
        const msg = JSON.parse(message) as ReceiveSignallingMsg;

        switch (msg.type) {
            // Server msg start
            case ReceiveSignallingTypes.CONNECTED_TO_SERVER: {
                if (this.currentState.type !== States.STALE) return panic();


                if (!isTransitionAllowed(this.currentState.type, States.READY)) return panic();
                this.currentState = { type: States.READY, userId: msg.userId, roomId: this.signallingAdaptor.getRoomId() };
                onMachineReady(this.currentState, msg.peerIds);

                break;
            }
            case ReceiveSignallingTypes.PEERCONNECTED: {
                if (this.currentState.type !== States.READY) return panic();

                onPeerConnectedToRoom(msg.userId);

                break;
            }
            case ReceiveSignallingTypes.PEERDISCONNECTED: {
                if (this.currentState.type !== States.READY) return panic();

                onPeerDisconnectedFromRoom(msg.userId);

                break;
            }
            // Server msg end
            case ReceiveSignallingTypes.OFFER: {
                if (this.currentState.type !== States.READY) return panic();

                const [rtcPeerConnection, rtcSignallingChannel, rtcDataChannel] = this.initNewRTCObj();

                const offer = new RTCSessionDescription(JSON.parse(msg.offer) as any);
                await rtcPeerConnection.setRemoteDescription(offer);

                await rtcPeerConnection.setLocalDescription(await rtcPeerConnection.createAnswer());

                if (!(await waitFor(() => rtcPeerConnection.iceGatheringState === 'complete'))) return panic();
                this.sendSignal({
                    toUserId: msg.fromUserId,
                    msg: {
                        type: ReceiveSignallingTypes.ANSWER,
                        fromUserId: this.currentState.userId,
                        answer: JSON.stringify(rtcPeerConnection.localDescription)
                    }
                });

                if (!isTransitionAllowed(this.currentState.type, States.CONNECTING)) return panic();

                this.currentState = {
                    type: States.CONNECTING,
                    userId: this.currentState.userId,
                    roomId: this.currentState.roomId,
                    peerId: msg.fromUserId,
                    rtcPeerConnection: rtcPeerConnection,
                    rtcSignallingChannel: rtcSignallingChannel,
                    rtcDataChannel: rtcDataChannel
                };


                break;
            }
            case ReceiveSignallingTypes.ANSWER: {
                if (this.currentState.type !== States.CONNECTING) return panic();

                const answer = new RTCSessionDescription(JSON.parse(msg.answer) as any);
                await this.currentState.rtcPeerConnection.setRemoteDescription(answer);


                break;
            }
        }
    }

    initRTCDataChannel(channel: RTCDataChannel) {
        channel.onmessage = (e: MessageEvent<unknown>) => {
            const data = e.data;
            if (!(data instanceof ArrayBuffer)) return panic();
            this.onDataReceived(data);
        };

        channel.onbufferedamountlow = () => {
            this.onDataChannelFree(MAX_WEBRTC_MSG_SIZE);
        };

        // https://stackoverflow.com/questions/66297347/why-does-calling-rtcpeerconnection-close-not-send-closed-event
        channel.onclose = () => {
            if (this.currentState.type === States.STALE || this.currentState.type === States.READY) return;
            if (this.currentState.type !== States.CONNECTED) return panic();

            if (!isTransitionAllowed(this.currentState.type, States.READY)) return panic();
            const peerId = this.currentState.peerId;
            this.currentState = { type: States.READY, userId: this.currentState.userId, roomId: this.currentState.roomId };
            onPeerDisconnected(peerId);
        };

        channel.onopen = () => {
            if (this.currentState.type !== States.CONNECTING) return panic();

            if (!isTransitionAllowed(this.currentState.type, States.CONNECTED)) return panic();
            this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };
            onPeerConnected(this.currentState.peerId);
        };
    }

    initRTCSignallingChannel(channel: RTCDataChannel) {
        channel.onmessage = async (e: MessageEvent<unknown>) => {
            const str = e.data;

            if (typeof str !== 'string') return panic();

            const data = JSON.parse(str);
            if (!data || !(typeof data === 'object') || !('type' in data)) return;

            const msg = data as Signal;
            switch (msg.type) {
                case SignalTypes.FILE_INFO_REQ: {
                    if (this.currentState.type != States.CONNECTED) return flowError();
                    //TODO: We have to look up offset here from local database eventually
                    const offset = await onFileInfoReqReceived(msg.fileName, msg.fileSize, msg.fileType);
                    if (!isTransitionAllowed(this.currentState.type, States.RECEIVING)) return flowError();

                    const negotiatedFileChunkSize = Math.min(FIXED_FILE_CHUNK_SIZE, msg.negotiatedFileChunkSize); // File Chunk size accordin to receiver needs


                    const currentSizeNeeded = Math.min(msg.fileSize, msg.negotiatedFileChunkSize); // May be we can replace with the method
                    this.sendPeerSignal({ type: SignalTypes.FILE_INFO_RES, accepted: true, haveTillOffset: offset, negotiatedFileChunkSize: negotiatedFileChunkSize }, this.currentState.rtcSignallingChannel);


                    const alreadyReceived = 1 + offset === msg.fileSize;
                    if (alreadyReceived) {
                        console.log('File was already received');
                        return;
                    }

                    this.currentState = { type: States.RECEIVING, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, receiveBuffer: new ByteArray(currentSizeNeeded), negotiatedFileChunkSize: negotiatedFileChunkSize, fileSize: msg.fileSize, receivedDataInCurrentChunk: 0, numberOfChunksReceived: 0, fileName: msg.fileName, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    break;
                }
                case SignalTypes.FILE_INFO_RES: {
                    if (this.currentState.type != States.CONNECTED) return flowError();
                    if (!this.sendingFileRef) return flowError();
                    if (!msg.accepted) {
                        // Reuest was rejected
                        // TODO: Show the user there the request was rejected
                        // Not sure if this feature should be given
                        return;
                    }

                    const alreadySent = 1 + msg.haveTillOffset === this.sendingFileRef.size;
                    // Can start the sending
                    await onFileInfoResReceived(msg.haveTillOffset, this.sendingFileRef, alreadySent);
                    if (alreadySent) {
                        console.log('File was already sent');
                        return;
                    }
                    const sendingFileBlob = new BlobReader(this.sendingFileRef, 1 + msg.haveTillOffset);


                    this.currentState = { type: States.SENDING, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, sendingFile: this.sendingFileRef, sendingFileBlob: sendingFileBlob, negotiatedFileChunkSize: msg.negotiatedFileChunkSize, sentDataInCurrentChunk: 0, numberOfChunksSent: 0, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    // Starts sending data. User responds means that it is ready for receiving data
                    this.onDataChannelFree(MAX_WEBRTC_MSG_SIZE); // This fixed for now
                    break;
                }
                case SignalTypes.SEND_NEXT_CHUNK_PING: {
                    if (this.currentState.type != States.SENDING) return flowError();

                    // TODO: Check if this leads to sync issues
                    this.currentState.sentDataInCurrentChunk = 0;
                    this.currentState.numberOfChunksSent += 1;

                    this.onDataChannelFree(MAX_WEBRTC_MSG_SIZE);
                    break;
                }
                case SignalTypes.RECEIVED_FILE_PING: {
                    if (this.currentState.type != States.SENDING) return flowError();

                    onFileSent(this.currentState.sendingFile);
                    this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    break;
                }
                case SignalTypes.PAUSE_SENDING_REQ: {
                    if (this.currentState.type === States.CONNECTED) return;
                    if (this.currentState.type !== States.SENDING) return flowError();
                    this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    this.sendPeerSignal({ type: SignalTypes.PAUSE_SENDING_RES }, this.currentState.rtcSignallingChannel);

                    break;
                }
                case SignalTypes.PAUSE_SENDING_RES: {
                    if (this.currentState.type === States.CONNECTED) return;
                    if (this.currentState.type !== States.RECEIVING) return flowError();

                    this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    onCanPauseReceiving();

                    break;
                }
                case SignalTypes.PAUSE_RECEIVING | SignalTypes.PAUSE_SENDING_RES: {
                    if (this.currentState.type === States.CONNECTED) return;
                    if (this.currentState.type !== States.RECEIVING) return flowError();
                    this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    break;
                }
            }

        }
    }

    initNewRTCObj(): [RTCPeerConnection, RTCDataChannel, RTCDataChannel] {
        const rtcPeerConnection = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVERS }] });

        // init data channels
        const rtcSignallingChannel = rtcPeerConnection.createDataChannel('signal', {
            ordered: true,
            negotiated: true,
            id: 1
        });
        this.initRTCSignallingChannel(rtcSignallingChannel);


        const rtcDataChannel = rtcPeerConnection.createDataChannel('data', {
            ordered: true,
            negotiated: true,
            id: 0
        });
        this.initRTCDataChannel(rtcDataChannel);

        // TOOD - Remove this
        rtcPeerConnection.onconnectionstatechange = () => {
            console.log('State changed ', rtcPeerConnection.connectionState);
        };

        return [rtcPeerConnection, rtcDataChannel, rtcSignallingChannel];
    }


    async connect(peerId: UserId) {
        if (this.currentState.type !== States.READY) return panic();
        const [rtcPeerConnection, rtcDataChannel, rtcSignallingChannel] = this.initNewRTCObj();
        await rtcPeerConnection.setLocalDescription(await rtcPeerConnection.createOffer());

        if (!(await waitFor(() => rtcPeerConnection.iceGatheringState === 'complete'))) return panic();

        this.sendSignal({
            toUserId: peerId,
            msg: {
                type: ReceiveSignallingTypes.OFFER,
                fromUserId: this.currentState.userId,
                offer: JSON.stringify(rtcPeerConnection.localDescription),
            }
        });


        this.currentState = {
            type: States.CONNECTING,
            userId: this.currentState.userId,
            roomId: this.currentState.roomId,
            peerId: peerId,
            rtcPeerConnection: rtcPeerConnection,
            rtcSignallingChannel: rtcSignallingChannel,
            rtcDataChannel: rtcDataChannel
        };
    }

    pauseReceivingFile() {
        if (this.currentState.type === States.CONNECTED) return;
        if (this.currentState.type !== States.RECEIVING) return flowError();
        this.sendPeerSignal({ type: SignalTypes.PAUSE_SENDING_REQ }, this.currentState.rtcSignallingChannel);
    }
    pauseSendingFile() {
        if (this.currentState.type === States.CONNECTED) return;
        if (this.currentState.type !== States.SENDING) return flowError();
        this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

        onCanPauseSending();
        this.sendPeerSignal({ type: SignalTypes.PAUSE_RECEIVING }, this.currentState.rtcSignallingChannel);
    }

    sendFile(file: File) {
        if (this.currentState.type !== States.CONNECTED) return flowError();

        this.sendingFileRef = file;
        console.log(file.size);
        // File chunk size according to the senders needs
        this.sendPeerSignal({ type: SignalTypes.FILE_INFO_REQ, fileName: file.name, fileSize: file.size, negotiatedFileChunkSize: FIXED_FILE_CHUNK_SIZE, fileType: file.type }, this.currentState.rtcSignallingChannel);
    }

    disconnect() {
        if (this.currentState.type === States.STALE || this.currentState.type === States.READY) return;
        if (this.currentState.type !== States.CONNECTED) return flowError();

        if (!isTransitionAllowed(this.currentState.type, States.READY)) return panic();
        onPeerDisconnected(this.currentState.peerId);
        this.currentState.rtcPeerConnection.close();
        this.currentState = { type: States.READY, userId: this.currentState.userId, roomId: this.currentState.roomId };
    }

    private sendPeerSignal(msg: Signal, rtcSignallingChannel: RTCDataChannel) {
        rtcSignallingChannel.send(JSON.stringify(msg));
    }

    sendData(data: ArrayBuffer, rtcDataChannel: RTCDataChannel) {
        rtcDataChannel.send(data);
    }


    async onDataReceived(data: ArrayBuffer) {
        if (this.currentState.type != States.RECEIVING) return flowError();

        const dataAndOffset = new Uint8Array(data);
        const size = dataAndOffset.length;
        // const offset = toBase10([
        //     ...dataAndOffset.subarray(dataAndOffset.length - 5, dataAndOffset.length)
        // ]);
        const offset = toBase10([dataAndOffset[size - 5], dataAndOffset[size - 4], dataAndOffset[size - 3], dataAndOffset[size - 2], dataAndOffset[size - 1]]);
        const fileData = dataAndOffset.subarray(0, dataAndOffset.length - 5);

        this.currentState.receiveBuffer.set(fileData, offset);

        this.currentState.receivedDataInCurrentChunk += fileData.byteLength;
        onMoreDataReceived(fileData.byteLength);
        // These conditions assuem that the receiveBuffer size is exactly equal to the amount of data it expects
        if (this.currentState.receivedDataInCurrentChunk > this.currentState.receiveBuffer.size) return panic('This should be impossible');
        if (this.currentState.receivedDataInCurrentChunk === this.currentState.receiveBuffer.size) {
            this.currentState.numberOfChunksReceived += 1;
            onChunkReceived(this.currentState.receiveBuffer, this.currentState.numberOfChunksReceived, this.currentState.fileName);

            const numberOfChunksToBeReceived = this.calculateNumChunks(this.currentState.fileSize, this.currentState.negotiatedFileChunkSize);
            if (this.currentState.numberOfChunksReceived > numberOfChunksToBeReceived) return panic('Should be impossible');
            if (this.currentState.numberOfChunksReceived === numberOfChunksToBeReceived) {
                await onFileReceived(this.currentState.fileName);
                this.currentState = { type: States.CONNECTED, userId: this.currentState.userId, roomId: this.currentState.roomId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                this.sendPeerSignal({ type: SignalTypes.RECEIVED_FILE_PING }, this.currentState.rtcSignallingChannel); // This also means that the receiver is ready for new file
            }
            else {
                this.currentState.numberOfChunksReceived += 1;
                const nextToBeSentChunkSize = this.calculateChunkSize(this.currentState.numberOfChunksReceived + 1, numberOfChunksToBeReceived, this.currentState.fileSize, this.currentState.negotiatedFileChunkSize);
                this.currentState.receiveBuffer.inner = this.currentState.receiveBuffer.inner.subarray(0, nextToBeSentChunkSize); // TODO: Test this
                this.currentState.receivedDataInCurrentChunk = 0;

                this.sendPeerSignal({ type: SignalTypes.SEND_NEXT_CHUNK_PING }, this.currentState.rtcSignallingChannel);
            }
        }
    }
}


enum SignalTypes {
    FILE_INFO_REQ,
    FILE_INFO_RES,
    SEND_NEXT_CHUNK_PING,
    RECEIVED_FILE_PING,
    PAUSE_SENDING_REQ,
    PAUSE_SENDING_RES,
    PAUSE_RECEIVING,
}
type Signal = FileInfoReq | FileInfoRes | SendNextChunkPing | ReceivedFilePing | PauseSendingReq | PauseSendingRes | PauseReceiving;
type FileInfoReq = {
    type: SignalTypes.FILE_INFO_REQ,
    fileName: string,
    fileSize: number,
    fileType: string,

    negotiatedFileChunkSize: number
}
type FileInfoRes = {
    type: SignalTypes.FILE_INFO_RES,
    accepted: boolean,
    haveTillOffset: number,

    negotiatedFileChunkSize: number,
}

type SendNextChunkPing = {
    type: SignalTypes.SEND_NEXT_CHUNK_PING
}

type ReceivedFilePing = {
    type: SignalTypes.RECEIVED_FILE_PING
}

type PauseSendingReq = {
    type: SignalTypes.PAUSE_SENDING_REQ
}

type PauseSendingRes = {
    type: SignalTypes.PAUSE_SENDING_RES
}
type PauseReceiving = {
    type: SignalTypes.PAUSE_RECEIVING
}


// Below should be purely UI manupulation 
// Machine LifeCycle
const onMachineReady = (ctx: ReadyCxt, peerIds: UserId[]) => {
    const [_u, setUserId] = userIdSignal;
    const [_r, setRoomId] = roomIdSignal;
    const [_p, setPeerIds] = peerIdsSignal;

    setUserId(ctx.userId);
    setRoomId(ctx.roomId);
    setPeerIds(peerIds);

};

const onPeerConnectedToRoom = (peerId: UserId) => {
    const [_peerId, setPeerIds] = peerIdsSignal;

    setPeerIds(e => [...e, peerId]);
};

const onPeerDisconnectedFromRoom = (peerId: UserId) => {
    const [_peerIds, setPeerIds] = peerIdsSignal;

    setPeerIds(cur => cur.filter(e => e !== peerId));
};

const onPeerConnected = (peerId: string) => {
    console.log(`${peerId} connected`);
    const [_peerId, setPeerId] = peerIdSignal;
    setPeerId(peerId);
};
const onPeerDisconnected = (peerId: string) => {
    console.log(`${peerId} disconnected`);
    const [_peerId, setPeerId] = peerIdSignal;
    setPeerId(null);
};

const onFileInfoReqReceived = async (name: string, size: number, type: string): Promise<number> => {
    if (!globalState.localStorage) return panic();
    const [_rf, setReceivingFileInfo] = receivingFileInfoSignal;
    const [_rb, setReceivedBytes] = receivedBytesSignal;

    let alreadyRecived = 0;
    const doesExists = await globalState.localStorage.doesReceivedFileExists(name);
    if (doesExists) {
        const prevFile = await globalState.localStorage.getReceivedFileInfoBy(name);
        let totalSize = 0;
        for (const e of prevFile.chunks) totalSize += e.size;

        alreadyRecived = totalSize - 1;
    }
    else {
        await globalState.localStorage.insertReceivedFile({
            name: name,
            size: size,
            type: type,
            completed: false,
            whenCompleted: Date.now(),
            chunks: []
        });


        alreadyRecived = 0;
    }
    setReceivedBytes(alreadyRecived);
    setReceivingFileInfo({
        name: name,
        size: size,
    });

    return alreadyRecived == 0 ? -1 : alreadyRecived;
};

const onFileInfoResReceived = async (haveTillOffset: number, fileToBeSent: File, alreadySent: boolean) => {
    if (!globalState.localStorage) return panic();
    const [_sfi, setSendingFileInfo] = sendingFileInfoSignal;
    const [_r, setSentBytes] = sentBytesSignal;
    const [_tbs, setToBeSentFiles] = filesQueuedToBeSentSignal;

    const doesExits = await globalState.localStorage.doesSentFileExists(fileToBeSent.name);
    if (!doesExits) {
        await globalState.localStorage.insertSentFile({
            name: fileToBeSent.name,
            size: fileToBeSent.size,
            type: fileToBeSent.type,
            completed: false,
            whenCompleted: Date.now(),
            file: fileToBeSent,
        });
    }

    // Maybe we can set this at the trigger of send
    setToBeSentFiles(e => e.slice(1));
    setSendingFileInfo({ file: fileToBeSent });
    setSentBytes(Math.max(haveTillOffset - 1, 0));
};

const onCanPauseSending = () => {
    const [sendingFileInfo, setSendingFileInfo] = sendingFileInfoSignal;
    const [sentBytes, setSentBytes] = sentBytesSignal;
    const [_f, setFilesPausedToBeSent] = filesPausedToBeSentSignal;

    if (sendingFileInfo() === null) return;

    setFilesPausedToBeSent(cur => [...cur, { file: sendingFileInfo()!.file, alreadySent: sentBytes() }]);
    setSendingFileInfo(null);
    setSentBytes(0);
};

const onCanPauseReceiving = () => {
    const [receivingFileInfo, setReceivingFileInfo] = receivingFileInfoSignal;
    const [receivedBytes, setReceivedBytes] = receivedBytesSignal;
    const [_f, setFilesPausedToBeReceived] = filesPausedToBeReceivedSignal;

    if (receivingFileInfo() === null) return;

    setFilesPausedToBeReceived(cur => [...cur, { name: receivingFileInfo()!.name, size: receivingFileInfo()!.size, alreadyReceived: receivedBytes() }]);
    setReceivingFileInfo(null);
    setReceivedBytes(0);
};

const onMoreDataSent = (dataSize: number) => {
    // TODO: THis is not acurate
    const [_s, setSentBytes] = sentBytesSignal;
    setSentBytes(e => e + dataSize);
};

const onMoreDataReceived = (sizeOfDataReceived: number) => {
    const [_r, setReceivedBytes] = receivedBytesSignal;
    setReceivedBytes(e => e + sizeOfDataReceived);
};

const onFileReceived = async (fileName: string) => {
    console.log('File was received');
};

const onFileSent = (file: File) => {
    console.log('File was sent completely');
};


const onChunkReceived = (chunk: ByteArray, chunkNumber: number, fileName: string) => {
    if (!globalState.localStorage) return panic();
    globalState.localStorage.addSplitToReceivedFileInfo(fileName, chunk.getBlob());
};


export default Machine;

