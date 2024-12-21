import { BlobReader } from "$src/BlobReader";
import ByteArray from "$src/BytesArray";
import { triggerFileSent } from "$src/Common";
import { FIXED_FILE_CHUNK_SIZE, MAX_WEBRTC_MSG_SIZE } from "$src/Constants";
import { globalState } from "$src/GlobalState";
import errroMsgSignal from "$src/stores/errorMsg";
import { filesPausedToBeReceivedSignal, filesPausedToBeSentSignal, filesQueuedToBeSentSignal, receivedBytesSignal, receivedFilesSignal, receivingFileInfoSignal, sendingFileInfoSignal, sentBytesSignal, sentFilesSignal } from "$src/stores/files";
import { loadingSignal } from "$src/stores/loading";
import peerIdSignal from "$src/stores/peer";
import userIdSignal from "$src/stores/user";
import { UserId } from "../models/types";
import SignallingPort from "../traits/SignallingPort";
import { STUN_SERVERS } from "../utils/Constants";
import { flowError, invariantViolation } from "../utils/Error";
import { toBase10, waitFor } from "../utils/utils";
import { toastInfo } from "$src/toast";

export enum States {
    NOT_CONNECTED_TO_SIGNALLING,
    READY_TO_BE_CONNECTED,
    CONNECTING_TO_PEER,
    CONNECTED_TO_PEER,
    SENDING_DATA,
    RECEIVING_DATA
}

type StaleCtx = {
    type: States.NOT_CONNECTED_TO_SIGNALLING
};


type ReadyCxt = {
    type: States.READY_TO_BE_CONNECTED,
    userId: UserId
};

type ConnectingCtx = {
    type: States.CONNECTING_TO_PEER,
    userId: UserId,
    peerId: UserId,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel
};

type ConnectedCtx = {
    type: States.CONNECTED_TO_PEER,
    userId: UserId,
    peerId: UserId,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel
};


type SendingCtx = {
    type: States.SENDING_DATA,
    userId: UserId,
    peerId: UserId,
    sendingFile: File
    negotiatedFileChunkSize: number
    numberOfChunksAlreadySent: number,
    sendingFileBlob: BlobReader,
    alreadySentDataInCurrentChunk: number,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel,
    offsetFromWhereSendingShouldStart: number,
};

type ReceivingCtx = {
    type: States.RECEIVING_DATA,
    userId: UserId,
    peerId: UserId,
    fileSize: number,
    fileName: string,
    negotiatedFileChunkSize: number,
    numberOfChunksAlreadyReceived: number,
    receiveBuffer: ByteArray,
    receivedDataInCurrentChunk: number,
    rtcPeerConnection: RTCPeerConnection,
    rtcDataChannel: RTCDataChannel,
    rtcSignallingChannel: RTCDataChannel,
    fileOffsetOfStartOfTheCurrentChunk: number,
    startedReceivingDataFromFileOffset: number,
};

type MachineState = StaleCtx | ReadyCxt | ConnectedCtx | ConnectingCtx | SendingCtx | ReceivingCtx;

enum ReceiveSignallingTypes {
    CONNECTED_TO_SERVER = 0,
    OFFER = 1,
    ANSWER = 2,
    ICE_CANDIDATE = 3,
    OFFER_REJECT = 4,
    CONNECT_PERMISSION_ASKED = 5,
    CONNECT_PERMISSION_GIVEN = 6,
}
type ConnectedToServer = {
    type: ReceiveSignallingTypes.CONNECTED_TO_SERVER,
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
type ICECandidate = {
    type: ReceiveSignallingTypes.ICE_CANDIDATE,
    fromUserId: UserId
    ice: string
};
type OfferReject = {
    type: ReceiveSignallingTypes.OFFER_REJECT,
    fromUserId: UserId
};
type ConnectPermissionAsked = {
    type: ReceiveSignallingTypes.CONNECT_PERMISSION_ASKED,
    fromUserId: UserId
};
type ConnectPermissionGiven = {
    type: ReceiveSignallingTypes.CONNECT_PERMISSION_GIVEN,
    fromUserId: UserId
};
type ReceiveSignallingMsg = ConnectedToServer | Offer | Answer | ICECandidate | OfferReject | ConnectPermissionAsked | ConnectPermissionGiven;

type SignallingSendMsg = {
    toUserId: UserId,
    msg: ReceiveSignallingMsg
};

class Machine {
    private currentState: MachineState;
    private signallingAdaptor: SignallingPort;
    private sendingFileRef: File | null = null;

    constructor(signallingAdaptor: SignallingPort) {
        this.currentState = { type: States.NOT_CONNECTED_TO_SIGNALLING };

        this.signallingAdaptor = signallingAdaptor;
        this.signallingAdaptor.onMsg(this.onSignallingMsg.bind(this));
        this.signallingAdaptor.onClose(this.onSignallingClose.bind(this));
        this.signallingAdaptor.onErr(this.onSignallingErr.bind(this));
    }

    state() {
        return this.currentState.type;
    }

    // TODO: May be can be improved
    calculateNumChunksToBeSent(apparentFileSize: number, negotiatedFileChunkSize: number) {
        return Math.ceil(apparentFileSize / negotiatedFileChunkSize);
    }

    calculateChunkSizeFor(chunkNumber: number, totalNumberOfChunks: number, negotiatedFileChunkSize: number, apparentFileSize: number) {
        if (chunkNumber > totalNumberOfChunks) {
            return invariantViolation(`chunkNumber ${chunkNumber} should not have been > than totalNumberOfChunks ${totalNumberOfChunks}`);
        }
        return chunkNumber < totalNumberOfChunks ? Math.min(apparentFileSize, negotiatedFileChunkSize) : apparentFileSize - negotiatedFileChunkSize * (totalNumberOfChunks - 1);
    }


    async onDataChannelFree(freeSpace: number) {
        if (this.currentState.type === States.CONNECTED_TO_PEER) {
            console.info('We are not in sending state. Will ignore this call. This can happend when sending was paused');
            return;
        }
        if (this.currentState.type != States.SENDING_DATA) {
            return flowError('onDataChannelFree should not have been fired since we are not in sending state');
        }

        if (this.currentState.rtcPeerConnection.connectionState !== 'connected') {
            console.info('RTC peer connection is not in connected state. Will ignore this call');
            return;
        }

        const currentChunkNumber = this.currentState.numberOfChunksAlreadySent + 1;
        const apparentFileSize = this.currentState.sendingFile.size - this.currentState.offsetFromWhereSendingShouldStart;
        const totalNumberOfChunks = this.calculateNumChunksToBeSent(apparentFileSize, this.currentState.negotiatedFileChunkSize); // This we can put on context
        if (currentChunkNumber > totalNumberOfChunks) {
            return invariantViolation(`currentChunkNumber ${currentChunkNumber} must not be > totalNumberOfChunks ${totalNumberOfChunks}`);
        }

        const sizeOfCurrentChunk = this.calculateChunkSizeFor(currentChunkNumber, totalNumberOfChunks, this.currentState.negotiatedFileChunkSize, apparentFileSize);
        if (this.currentState.alreadySentDataInCurrentChunk > sizeOfCurrentChunk) {
            return invariantViolation(`sentData ${this.currentState.alreadySentDataInCurrentChunk} should not be > sizeOfCurrentChunk ${sizeOfCurrentChunk} that was to be sent`);
        }

        if (this.currentState.alreadySentDataInCurrentChunk === sizeOfCurrentChunk) {
            console.info('The sending of current chunk has completed');
            return;
        }

        const data = await this.currentState.sendingFileBlob.read(freeSpace);
        this.sendData(data, this.currentState.rtcDataChannel);
        const actualDataSize = data.byteLength - BlobReader.indexSize;
        this.currentState.alreadySentDataInCurrentChunk += actualDataSize; // Need to abstract this better

        onMoreDataSent(actualDataSize);
    }


    sendSignal(msg: SignallingSendMsg) {
        //console.log("Sending " + msg);
        const data = { toUserId: msg.toUserId, msg: JSON.stringify(msg.msg) };
        this.signallingAdaptor.send(JSON.stringify(data));
    }

    onSignallingClose() {
        console.log('onSignallingClose called');
        if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING) {
            return flowError("Can't get a signalling close when we where not in READY in the first place");
        }

        if(this.currentState.type === States.RECEIVING_DATA || this.currentState.type === States.SENDING_DATA || this.currentState.type === States.CONNECTED_TO_PEER) {
            const [_, showError] = errroMsgSignal;
            showError("Connection to the sever lost. Please refresh after the current peer disconnects");
            return;
        }

        const [_, showError] = errroMsgSignal;
        showError("Connection to the sever lost. Please refresh and try again");
        this.currentState = { type: States.NOT_CONNECTED_TO_SIGNALLING };
    }

    onSignallingErr() {
        console.log('Signalling on error called');
        if(this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING) {
            const [_l, setLoading] = loadingSignal;
            const [_r, setError] = errroMsgSignal; 
            setLoading(false);
            setError("Could not connect to the server. Please refresh and try again");
            return;
        }
        this.signallingAdaptor.close(); // This will call the onclose 
    }

    async onSignallingMsg(message: string) {
        const msg = JSON.parse(message) as ReceiveSignallingMsg;
        //console.log("Receivied ", JSON.stringify(message));

        switch (msg.type) {
            // Server msg start
            case ReceiveSignallingTypes.CONNECTED_TO_SERVER: {
                if (this.currentState.type !== States.NOT_CONNECTED_TO_SIGNALLING) {
                    console.log('Already connected to signalling', this.currentState.type);
                    return;
                }

                this.currentState = { type: States.READY_TO_BE_CONNECTED, userId: msg.userId };
                onMachineConnectedToSignalling(this.currentState);

                break;
            }
            // Server msg end
            case ReceiveSignallingTypes.OFFER: {
                if (this.currentState.type !== States.CONNECTING_TO_PEER) {
                    return flowError("Can't receive a offer if if not in CONNECTING_TO_PEER state");
                }

                const offer = new RTCSessionDescription(JSON.parse(msg.offer) as any);
                await this.currentState.rtcPeerConnection.setRemoteDescription(offer);

                await this.currentState.rtcPeerConnection.setLocalDescription(await this.currentState.rtcPeerConnection.createAnswer());

                //if (!(await waitFor(() => rtcPeerConnection.iceGatheringState === 'complete'))) return panic();
                this.sendSignal({
                    toUserId: msg.fromUserId,
                    msg: {
                        type: ReceiveSignallingTypes.ANSWER,
                        fromUserId: this.currentState.userId,
                        answer: JSON.stringify(this.currentState.rtcPeerConnection.localDescription)
                    }
                });

                break;
            }
            case ReceiveSignallingTypes.CONNECT_PERMISSION_ASKED: {
                if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING) {
                    return flowError("Can't receive a CONNECT_PERMISSION_ASKED if was never connected to the signalling server");
                }

                if (this.currentState.type !== States.READY_TO_BE_CONNECTED) {
                    this.sendSignal({
                        toUserId: msg.fromUserId,
                        msg: {
                            type: ReceiveSignallingTypes.OFFER_REJECT,
                            fromUserId: this.currentState.userId
                        }
                    });

                    console.info(`Can't accept the connect permission ask. The state is ${this.currentState.type}`);
                    return;
                }

                const [rtcPeerConnection, rtcDataChannel, rtcSignallingChannel] = this.initNewRTCObj();
                this.currentState = {
                    type: States.CONNECTING_TO_PEER,
                    userId: this.currentState.userId,
                    peerId: msg.fromUserId,
                    rtcPeerConnection: rtcPeerConnection,
                    rtcSignallingChannel: rtcSignallingChannel,
                    rtcDataChannel: rtcDataChannel
                };

                onConnectionOfferReceived();
                this.sendSignal({
                    toUserId: msg.fromUserId,
                    msg: {
                        type: ReceiveSignallingTypes.CONNECT_PERMISSION_GIVEN,
                        fromUserId: this.currentState.userId,
                    }
                });

                break;
            }
            case ReceiveSignallingTypes.CONNECT_PERMISSION_GIVEN: {
                if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING) {
                    return flowError("Can't receive a CONNECT_PERMISSION_GIVEN if was never connected to the signalling server");
                }

                const [rtcPeerConnection, rtcDataChannel, rtcSignallingChannel] = this.initNewRTCObj();
                await rtcPeerConnection.setLocalDescription(await rtcPeerConnection.createOffer());
                this.currentState = {
                    type: States.CONNECTING_TO_PEER,
                    userId: this.currentState.userId,
                    peerId: msg.fromUserId,
                    rtcPeerConnection: rtcPeerConnection,
                    rtcSignallingChannel: rtcSignallingChannel,
                    rtcDataChannel: rtcDataChannel
                };

                this.sendSignal({
                    toUserId: msg.fromUserId,
                    msg: {
                        type: ReceiveSignallingTypes.OFFER,
                        fromUserId: this.currentState.userId,
                        offer: JSON.stringify(rtcPeerConnection.localDescription),
                    }
                });

                break;
            }
            case ReceiveSignallingTypes.ANSWER: {
                if (this.currentState.type !== States.CONNECTING_TO_PEER) {
                    return flowError("Can't receive an answer if state was not CONNECTING_TO_PEER");
                } 

                const answer = new RTCSessionDescription(JSON.parse(msg.answer) as any);
                await this.currentState.rtcPeerConnection.setRemoteDescription(answer);

                break;
            }
            case ReceiveSignallingTypes.ICE_CANDIDATE: {
                if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING) {
                    return flowError('Should not receive ICE candidates when not connected to the signalling server');
                } 
                if(this.currentState.type === States.READY_TO_BE_CONNECTED) {
                    return flowError('Should not receive ICE candidates when READY_TO_BE_CONNECTED state');
                }

                this.currentState.rtcPeerConnection.addIceCandidate(JSON.parse(msg.ice) as RTCIceCandidateInit);
                break;
            }
            case ReceiveSignallingTypes.OFFER_REJECT: {
                onOfferRejected();
                break;
            }
        }
    }

    initRTCDataChannel(channel: RTCDataChannel) {
        channel.binaryType = 'arraybuffer';
        channel.onmessage = (e: MessageEvent<unknown>) => {
            const data = e.data;
            //console.log(data);
            if (!(data instanceof ArrayBuffer)) {
                return invariantViolation('The data received from the data channel was not of type ArrayBuffer');
            } 
            this.onDataReceived(data);
        };

        channel.onbufferedamountlow = () => {
            this.onDataChannelFree(MAX_WEBRTC_MSG_SIZE);
        };

        // https://stackoverflow.com/questions/66297347/why-does-calling-rtcpeerconnection-close-not-send-closed-event
        channel.onclose = () => {
            if (this.currentState.type !== States.CONNECTED_TO_PEER && this.currentState.type !== States.SENDING_DATA && this.currentState.type !== States.RECEIVING_DATA) {
                return flowError(`onclose cannot be called if we never had a rtc connection. The state was ${this.currentState.type}`);
            } 

            const peerId = this.currentState.peerId;
            if(this.signallingAdaptor.isConnectionAlive()) {
                this.currentState = { type: States.READY_TO_BE_CONNECTED, userId: this.currentState.userId };
            }
            else {
                this.currentState = { type: States.NOT_CONNECTED_TO_SIGNALLING };
            }

            onPeerDisconnected(peerId);
        };

        channel.onopen = () => {
            if (this.currentState.type !== States.CONNECTING_TO_PEER) {
                return flowError('This should not be called if we never tried connecting to a peer');
            } 

            this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };
            onPeerConnected(this.currentState.peerId);
        };
    }

    initRTCSignallingChannel(channel: RTCDataChannel) {
        channel.onmessage = async (e: MessageEvent<unknown>) => {
            const str = e.data;

            if (typeof str !== 'string') {
                return invariantViolation('The rtc signalling channel must exchnge data of type string');
            } 

            const data = JSON.parse(str);
            if (!data || !(typeof data === 'object') || !('type' in data)) return;

            const msg = data as Signal;
            switch (msg.type) {
                case SignalTypes.FILE_INFO_REQ: {
                    if (this.currentState.type != States.CONNECTED_TO_PEER) {
                        return flowError(`Cannot signal ${this.currentState.type} when we are not connected to a peer`);
                    } 
                    const fileOffsetOfAlreadyReceivedData = await getOffsetForFile(msg.fileName, msg.fileSize, msg.fileType);
                    const alreadyReceivedBytes = 1 + fileOffsetOfAlreadyReceivedData;
                    const haveAlreadyReceivedEntireFile = alreadyReceivedBytes === msg.fileSize;
                    if (haveAlreadyReceivedEntireFile) {
                        onFileAlreayReceived(msg.fileName, msg.fileSize);
                        return;
                    }
                    onWillBeReceivingFile(msg.fileName, msg.fileSize, msg.fileType, 1 + fileOffsetOfAlreadyReceivedData);

                    const negotiatedFileChunkSize = Math.min(FIXED_FILE_CHUNK_SIZE, msg.negotiatedFileChunkSize); // File Chunk size accordin to receiver needs
                    // const numberOfChunksReceived = Math.floor(alreadyReceivedBytes / negotiatedFileChunkSize);
                    // if(negotiatedFileChunkSize * numberOfChunksReceived !== alreadyReceivedBytes) {
                    //     return invariantViolation(`Incorrect already received calculation negotiatedFileChunkSize ${negotiatedFileChunkSize} * numberOfChunksReceived ${numberOfChunksReceived} !== alreadyReceivedBytes ${alreadyReceivedBytes}`);
                    // }


                    const fileOffsetFromWhereReceivingShouldStart = 1 + fileOffsetOfAlreadyReceivedData;
                    const apparentFileSize = msg.fileSize - fileOffsetFromWhereReceivingShouldStart;
                    const currentBufferSizeNeeded = Math.min(apparentFileSize, msg.negotiatedFileChunkSize); // May be we can replace with the method
                    this.currentState = { type: States.RECEIVING_DATA, userId: this.currentState.userId, peerId: this.currentState.peerId, receiveBuffer: new ByteArray(currentBufferSizeNeeded), negotiatedFileChunkSize: negotiatedFileChunkSize, fileSize: msg.fileSize, receivedDataInCurrentChunk: 0, numberOfChunksAlreadyReceived: 0, fileName: msg.fileName, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel, fileOffsetOfStartOfTheCurrentChunk: fileOffsetFromWhereReceivingShouldStart, startedReceivingDataFromFileOffset: fileOffsetFromWhereReceivingShouldStart };

                    this.sendPeerSignal({ type: SignalTypes.FILE_INFO_RES, accepted: true, receiverAlreadyHasDataTillOffset: fileOffsetOfAlreadyReceivedData, negotiatedFileChunkSize: negotiatedFileChunkSize, numberOfChunksAlreadyReceived: 0}, this.currentState.rtcSignallingChannel);

                    break;
                }
                case SignalTypes.FILE_INFO_RES: {
                    if (this.currentState.type != States.CONNECTED_TO_PEER) {
                        return flowError(`Cannot signal ${this.currentState.type} when we are not connected to a peer`);
                    }
                    if (!this.sendingFileRef) {
                        return invariantViolation('The sendingFileRef cannot be null since I am getting FILE_INFO_RES');
                    } 
                    if (!msg.accepted) {
                        toastInfo('The request was rejected by the peer');
                        return;
                    }

                    const alreadySentBytes = 1 + msg.receiverAlreadyHasDataTillOffset;
                    const isFileAlreadySent = alreadySentBytes === this.sendingFileRef.size;
                    // Can start the sending
                    await onFileInfoResReceived(msg.receiverAlreadyHasDataTillOffset, this.sendingFileRef, isFileAlreadySent);
                    if (isFileAlreadySent) {
                        onFileAlreadySent(this.sendingFileRef.name, this.sendingFileRef.size);
                        return;
                    }
                    const sendingFileBlob = new BlobReader(this.sendingFileRef, alreadySentBytes);

                    this.currentState = { type: States.SENDING_DATA, userId: this.currentState.userId, peerId: this.currentState.peerId, sendingFile: this.sendingFileRef, sendingFileBlob: sendingFileBlob, negotiatedFileChunkSize: msg.negotiatedFileChunkSize, alreadySentDataInCurrentChunk: 0, numberOfChunksAlreadySent: 0, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel, offsetFromWhereSendingShouldStart: 1 + msg.receiverAlreadyHasDataTillOffset };

                    // Starts sending data. User responds means that it is ready for receiving data
                    this.onDataChannelFree(MAX_WEBRTC_MSG_SIZE); // This fixed for now
                    break;
                }
                case SignalTypes.SEND_NEXT_CHUNK_PING: {
                    if (this.currentState.type != States.SENDING_DATA) {
                        return flowError(`Cannot receive SEND_NEXT_CHUNK_PING when state is not SENDING_DATA`);
                    }

                    // TODO: Check if this leads to sync issues
                    this.currentState.alreadySentDataInCurrentChunk = 0;
                    this.currentState.numberOfChunksAlreadySent += 1;

                    this.onDataChannelFree(MAX_WEBRTC_MSG_SIZE);
                    break;
                }
                case SignalTypes.RECEIVED_FILE_PING: {
                    if (this.currentState.type != States.SENDING_DATA) {
                        return flowError(`Cannot receive RECEIVED_FILE_PING when state is not SENDING_DATA`);
                    } 

                    this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };
                    // TODO: May be this should be above this
                    onFileSent();

                    break;
                }
                case SignalTypes.PAUSE_SENDING_REQ: {
                    if (this.currentState.type === States.CONNECTED_TO_PEER) return;
                    if (this.currentState.type !== States.SENDING_DATA) {
                        return flowError(`Cannot receive PAUSE_SENDING_REQ when state is not SENDING_DATA`);
                    } 

                    this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    this.sendPeerSignal({ type: SignalTypes.PAUSE_SENDING_RES }, this.currentState.rtcSignallingChannel);

                    onPauseSendingReqReceived();

                    break;
                }
                case SignalTypes.PAUSE_SENDING_RES: {
                    if (this.currentState.type === States.CONNECTED_TO_PEER) return;
                    if (this.currentState.type !== States.RECEIVING_DATA) {
                        return flowError(`Cannot receive PAUSE_SENDING_RES when state is not RECEIVING_DATA`);
                    } 

                    this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    onCanPauseReceiving();

                    break;
                }
                case SignalTypes.PAUSE_RECEIVING_REQ: {
                    if (this.currentState.type === States.CONNECTED_TO_PEER) return;
                    if (this.currentState.type !== States.RECEIVING_DATA) {
                        return flowError(`Cannot receive PAUSE_RECEIVING_REQ when state is not PAUSE_RECEIVING_REQ`);
                    } 
                    this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                    onPauseReceivingReqReceived();
                    this.sendPeerSignal({ type: SignalTypes.PAUSE_RECEIVING_RES }, this.currentState.rtcSignallingChannel);
                    break;
                }
                case SignalTypes.PAUSE_RECEIVING_RES: {
                    onPauseReceivingResReceived();
                }
            }
        }
    }

    initNewRTCObj(): [RTCPeerConnection, RTCDataChannel, RTCDataChannel] {
        const rtcPeerConnection = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVERS }] });

        // init data channels
        const rtcSignallingChannel = rtcPeerConnection.createDataChannel('signal', {
            ordered: false,
            negotiated: true,
            id: 1
        });
        this.initRTCSignallingChannel(rtcSignallingChannel);


        const rtcDataChannel = rtcPeerConnection.createDataChannel('data', {
            ordered: false,
            negotiated: true,
            id: 0
        });
        this.initRTCDataChannel(rtcDataChannel);

        // TOOD - Remove this
        // rtcPeerConnection.onconnectionstatechange = () => {
        //     console.log('State changed ', rtcPeerConnection.connectionState);
        // };
        // rtcPeerConnection.onnegotiationneeded = (e) => {
        //     console.log(e);
        // };
        rtcPeerConnection.onicecandidate = (e) => {
            //console.log(e.candidate, rtcPeerConnection.iceGatheringState);
            if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING || this.currentState.type === States.READY_TO_BE_CONNECTED) {
                return;
            } 
            //if (e.candidate === null) return;
            this.sendSignal({ toUserId: this.currentState.peerId, msg: { type: ReceiveSignallingTypes.ICE_CANDIDATE, fromUserId: this.currentState.userId, ice: JSON.stringify(e.candidate) } });
        };

        return [rtcPeerConnection, rtcDataChannel, rtcSignallingChannel];
    }


    async connect(peerId: UserId) {
        if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING || !this.signallingAdaptor.isConnectionAlive()) {
            const [_e, showError] = errroMsgSignal;
            const [_l, setLoading] = loadingSignal;
            setLoading(false);
            showError("Not connected to the server. Please refresh and try again");
            return;
        } 
        if (this.currentState.type !== States.READY_TO_BE_CONNECTED) {
            return flowError('Only READY_TO_BE_CONNECTED should be possible at this point');
        } 
        //if (!(await waitFor(() => rtcPeerConnection.iceGatheringState === 'complete'))) return panic();

        this.sendSignal({
            toUserId: peerId,
            msg: {
                type: ReceiveSignallingTypes.CONNECT_PERMISSION_ASKED,
                fromUserId: this.currentState.userId,
            }
        });
    }

    pauseReceivingFile() {
        if (this.currentState.type === States.CONNECTED_TO_PEER) {
            return;
        } 
        if (this.currentState.type !== States.RECEIVING_DATA) {
            return flowError("pauseReceivingFile can't be called when I was not RECEIVING_DATA");
        } 
        this.sendPeerSignal({ type: SignalTypes.PAUSE_SENDING_REQ }, this.currentState.rtcSignallingChannel);
    }

    pauseSendingFile() {
        if (this.currentState.type === States.CONNECTED_TO_PEER) return;
        if (this.currentState.type !== States.SENDING_DATA) {
            return flowError("pauseSendingFile can't be called when I was not SENDING_DATA");
        } 
        this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

        // TODO: may be this should be in onPauseReceivingResReceived
        onCanPauseSending();
        this.sendPeerSignal({ type: SignalTypes.PAUSE_RECEIVING_REQ }, this.currentState.rtcSignallingChannel);
    }

    sendFile(file: File) {
        if (this.currentState.type !== States.CONNECTED_TO_PEER) {
            return flowError(`sendFile should not be called when state is ${this.currentState.type}`);
        }

        this.sendingFileRef = file;
        // File chunk size according to the senders needs
        this.sendPeerSignal({ type: SignalTypes.FILE_INFO_REQ, fileName: file.name, fileSize: file.size, negotiatedFileChunkSize: FIXED_FILE_CHUNK_SIZE, fileType: file.type }, this.currentState.rtcSignallingChannel);
    }

    disconnect() {
        if (this.currentState.type === States.NOT_CONNECTED_TO_SIGNALLING || this.currentState.type === States.READY_TO_BE_CONNECTED) {
            console.info("Can't disconnect because was never connected to a peer");
            return;
        } 

        //onPeerDisconnected(this.currentState.peerId);
        this.currentState.rtcPeerConnection.close();
    }

    private sendPeerSignal(msg: Signal, rtcSignallingChannel: RTCDataChannel) {
        rtcSignallingChannel.send(JSON.stringify(msg));
    }

    sendData(data: ArrayBuffer, rtcDataChannel: RTCDataChannel) {
        rtcDataChannel.send(data);
    }


    async onDataReceived(data: ArrayBuffer) {
        if (this.currentState.type == States.CONNECTED_TO_PEER) {
            console.info('This can happen when the sending was paused');
            return;
        } 
        if (this.currentState.type != States.RECEIVING_DATA) {
            return flowError(`onDataReceived should not be called when in ${this.currentState.type}`);
        } 

        const dataAndOffset = new Uint8Array(data);
        const size = dataAndOffset.length;
        // const offset = toBase10([
        //     ...dataAndOffset.subarray(dataAndOffset.length - 5, dataAndOffset.length)
        // ]);
        const offsetOfReceivedDataInFile = toBase10([dataAndOffset[size - 5], dataAndOffset[size - 4], dataAndOffset[size - 3], dataAndOffset[size - 2], dataAndOffset[size - 1]]);
        const receivedFileData = dataAndOffset.subarray(0, dataAndOffset.length - 5);

        const receiveBufferOffsetWhereCurrentDataWillBeSet = offsetOfReceivedDataInFile - this.currentState.fileOffsetOfStartOfTheCurrentChunk;
        this.currentState.receiveBuffer.set(receivedFileData, receiveBufferOffsetWhereCurrentDataWillBeSet);

        this.currentState.receivedDataInCurrentChunk += receivedFileData.byteLength;
        onMoreDataReceived(receivedFileData.byteLength);
        // These conditions assumes that the receiveBuffer size is exactly equal to the amount of data it expects
        if (this.currentState.receivedDataInCurrentChunk > this.currentState.receiveBuffer.inner.byteLength) {
            return invariantViolation(`receivedDataInCurrentChunk ${this.currentState.receivedDataInCurrentChunk} should not be > receiveBuffer size ${this.currentState.receiveBuffer.inner.byteLength}`);
        } 
        const apparentFileSize = this.currentState.fileSize - this.currentState.startedReceivingDataFromFileOffset;
        if (this.currentState.receivedDataInCurrentChunk === this.currentState.receiveBuffer.inner.byteLength) {
            await onChunkReceived(this.currentState.receiveBuffer, this.currentState.numberOfChunksAlreadyReceived, this.currentState.fileName);

            this.currentState.numberOfChunksAlreadyReceived += 1;
            this.currentState.fileOffsetOfStartOfTheCurrentChunk += this.currentState.receiveBuffer.inner.byteLength;  

            const numberOfChunksToBeReceived = this.calculateNumChunksToBeSent(apparentFileSize, this.currentState.negotiatedFileChunkSize);
            if (this.currentState.numberOfChunksAlreadyReceived > numberOfChunksToBeReceived) {
                return invariantViolation(`numberOfChunksReceived ${this.currentState.numberOfChunksAlreadyReceived} should not be > than numberOfChunksToBeReceived ${numberOfChunksToBeReceived}`);
            } 

            if (this.currentState.numberOfChunksAlreadyReceived === numberOfChunksToBeReceived) {
                await onFileReceived();
                this.currentState = { type: States.CONNECTED_TO_PEER, userId: this.currentState.userId, peerId: this.currentState.peerId, rtcPeerConnection: this.currentState.rtcPeerConnection, rtcSignallingChannel: this.currentState.rtcSignallingChannel, rtcDataChannel: this.currentState.rtcDataChannel };

                this.sendPeerSignal({ type: SignalTypes.RECEIVED_FILE_PING }, this.currentState.rtcSignallingChannel); // This also means that the receiver is ready for new file
            }
            else {
                const numberOfChunkThatWillBeReceivedNext = this.currentState.numberOfChunksAlreadyReceived + 1
                const nextToBeSentChunkSize = this.calculateChunkSizeFor(numberOfChunkThatWillBeReceivedNext, numberOfChunksToBeReceived, this.currentState.negotiatedFileChunkSize, apparentFileSize);
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
    PAUSE_RECEIVING_REQ,
    PAUSE_RECEIVING_RES,
}
type Signal = FileInfoReq | FileInfoRes | SendNextChunkPing | ReceivedFilePing | PauseSendingReq | PauseSendingRes | PauseReceivingReq | PauseReceivingRes;
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
    receiverAlreadyHasDataTillOffset: number,

    negotiatedFileChunkSize: number,
    numberOfChunksAlreadyReceived: number
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
type PauseReceivingReq = {
    type: SignalTypes.PAUSE_RECEIVING_REQ
}
type PauseReceivingRes = {
    type: SignalTypes.PAUSE_RECEIVING_RES
}



// Below should be purely UI manupulation 
// Machine LifeCycle
const onMachineConnectedToSignalling = (ctx: ReadyCxt) => {
    const [_u, setUserId] = userIdSignal;
    const [_l, setLoading] = loadingSignal;

    setUserId(ctx.userId);
    setLoading(false);
};

const onPeerConnected = (peerId: string) => {
    const [_peerId, setPeerId] = peerIdSignal;
    setPeerId(peerId);
    loadingSignal[1](false);
};
const onPeerDisconnected = (peerId: string) => {
    const [sendingFileInfo, setSendingFileInfo] = sendingFileInfoSignal;
    const [_sb, setSentBytes] = sentBytesSignal;

    const [receivingFileInfo, setReceivingFileInfo] = receivingFileInfoSignal;;
    const [receivedBytes, setReceivedBytes] = receivedBytesSignal;

    const [_s, setFilesPausedToBeSent] = filesPausedToBeSentSignal;
    const [_r, setFilesPausedToBeReceived] = filesPausedToBeReceivedSignal;

    const sendingFile = sendingFileInfo();
    if (sendingFile !== null) {
        setFilesPausedToBeSent(cur => [{ file: sendingFile.file }, ...cur]);
        setSendingFileInfo(null);
        setSentBytes(0);
    }

    const receivingFile = receivingFileInfo();
    if (receivingFile !== null) {
        setFilesPausedToBeReceived(cur => [{ name: receivingFile.name, size: receivingFile.size, alreadyReceived: receivedBytes() }, ...cur]);
        setReceivingFileInfo(null);
        setReceivedBytes(0);
    }

    const [_peerId, setPeerId] = peerIdSignal;
    setPeerId(null);
    toastInfo('Connection to peer lost');
};

const getOffsetForFile = async (name: string, size: number, type: string): Promise<number> => {
    if (!globalState.localStorage) {
        return invariantViolation('getOffsetForFile should not be called when localStorage is null');
    } 

    const doesExists = await globalState.localStorage.doesReceivedFileExists(name);
    if (doesExists) {
        const prevFile = await globalState.localStorage.getReceivedFileInfoBy(name);
        let totalSize = 0;
        for (const e of prevFile.chunks) totalSize += e.size;

        return totalSize - 1;
    }
    await globalState.localStorage.insertReceivedFile({
        name: name,
        size: size,
        type: type,
        completed: false,
        whenCompleted: Date.now(),
        chunks: []
    });

    return -1;
};
const onWillBeReceivingFile = (name: string, size: number, _type: string, alreadyRecived: number) => {
    const [_rf, setReceivingFileInfo] = receivingFileInfoSignal;
    const [_rb, setReceivedBytes] = receivedBytesSignal;
    const [_rc, setReceivedFiles] = receivedFilesSignal;
    const [_rd, setFilesPausedToBeReceived] = filesPausedToBeReceivedSignal;

    setReceivedBytes(alreadyRecived);
    setReceivingFileInfo({
        name: name,
        size: size,
    });

    setReceivedFiles(cur => cur.filter(e => e.filename !== name));
    setFilesPausedToBeReceived(cur => cur.filter(e => e.name !== name));

    toastInfo('Receiving file. Added to transfers');
};

const onFileAlreayReceived = (filename: string, size: number) => {
    const [_rc, setReceivedFiles] = receivedFilesSignal;
    setReceivedFiles(cur => [{ filename: filename, size: size }, ...cur.filter(e => e.filename !== filename)]);
};

const onFileAlreadySent = (filename: string, size: number) => {
    const [_s, setsentFiles] = sentFilesSignal;
    setsentFiles(cur => [{ filename: filename, size: size }, ...cur.filter(e => e.filename !== filename)]);
};
const onFileInfoResReceived = async (receiverAlreadyHasDataTillOffset: number, fileToBeSent: File, alreadySent: boolean) => {
    if (!globalState.localStorage) {
        return invariantViolation('onFileInfoResReceived should not be called when localStorage is null');
    } 
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
    setSentBytes(Math.max(receiverAlreadyHasDataTillOffset - 1, 0));
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

const onPauseReceivingResReceived = () => {
    // TODO: Commented because this causes user to stop each and every file sent manually
    // triggerFileSent();
};

const onPauseSendingReqReceived = () => {
    onCanPauseSending();
};

const onPauseReceivingReqReceived = () => {
    onCanPauseReceiving();
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

const onFileReceived = async () => {
    const [receivingFileInfo, setReceivingFileInfo] = receivingFileInfoSignal;
    const [_rbs, setReceivedBytes] = receivedBytesSignal;
    const [_rfs, setReceivedFiles] = receivedFilesSignal;

    const info = receivingFileInfo();
    if (info === null) return;

    await globalState.localStorage?.markReceivedFileCompleted(info.name);

    setReceivedFiles(cur => [{ filename: info.name, size: info.size }, ...cur]);

    setReceivingFileInfo(null);
    setReceivedBytes(0);

    setTimeout(() => {
        if (globalState.machine === null) return;
        if (globalState.machine.state() !== States.CONNECTED_TO_PEER) return;
        triggerFileSent();
    }, 3000);
};

const onFileSent = () => {
    const [sendingFileInfo, setSendingFileInfo] = sendingFileInfoSignal;
    const [_sentBytes, setSentBytes] = sentBytesSignal;
    const [_sentFiles, setSentFiles] = sentFilesSignal;

    const info = sendingFileInfo();
    if (info === null) return;

    globalState.localStorage?.markSentFileCompleted(info.file.name);
    setSentFiles(cur => [{ filename: info.file.name, size: info.file.size }, ...cur]);

    setSendingFileInfo(null);
    setSentBytes(0);

    triggerFileSent();
};


const onChunkReceived = async (chunk: ByteArray, chunkNumber: number, fileName: string) => {
    if (!globalState.localStorage) {
        return invariantViolation('onChunkReceived should not be called when localStorage is null');
    }
    await globalState.localStorage.addSplitToReceivedFileInfo(fileName, chunk.getBlob());
};


const onOfferRejected = () => {
    const [_, setErrorMsg] = errroMsgSignal;
    setErrorMsg("The other seems busy. Try after sometime");
};

const onConnectionOfferReceived = () => {
    loadingSignal[1](true);
};


export default Machine;

