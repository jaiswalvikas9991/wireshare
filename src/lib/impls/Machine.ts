import roomIdSignal from "$src/stores/room";
import userIdSignal from "$src/stores/user";
import { RoomId, UserId } from "../models/types";
import SignallingPort from "../traits/SignallingPort";
import { STUN_SERVERS } from "../utils/Constants";
import { panic } from "../utils/Error";
import { waitFor } from "../utils/utils";

enum States {
    INIT,
    READY,
    CONNECTED,

    DISCONNECTED
}

const Transitions = {
    [States.INIT]: [States.READY],
    [States.READY]: [States.CONNECTED],
    [States.CONNECTED]: [States.DISCONNECTED],
    [States.DISCONNECTED]: []
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
    CONNECTED,
    OFFER,
    ANSWER
}
type Connected = {
    type: ReceiveSignallingTypes.CONNECTED,
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
type ReceiveSignallingMsg = Connected | Offer | Answer;

type SignallingSendMsg = {
    toUserId: UserId,
    msg: ReceiveSignallingMsg
};

class Machine {
    private currentState: States;
    private signallingAdaptor: SignallingPort;
    private rtcPeerConnection: RTCPeerConnection;
    private rtcDataChannel: RTCDataChannel;
    private rtcSignallingChannel: RTCDataChannel;

    private userId: UserId | null = null;



    constructor(signallingAdaptor: SignallingPort) {
        this.currentState = States.INIT;

        this.signallingAdaptor = signallingAdaptor;
        this.signallingAdaptor.onMsg(this.onSignallingMsg.bind(this));

        this.rtcPeerConnection = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVERS }] });
        this.initRTCPeerConnection();
    }


    sendSignal(msg: SignallingSendMsg) {
        const data = { toUserId: msg.toUserId, msg: JSON.stringify(msg.msg) };
        this.signallingAdaptor.send(JSON.stringify(data));
    }

    async onSignallingMsg(message: string) {
        const msg = JSON.parse(message) as ReceiveSignallingMsg;

        switch (msg.type) {
            case ReceiveSignallingTypes.CONNECTED: {
                if (this.currentState !== States.INIT) return panic();

                initUIUpdate(this.signallingAdaptor.getRoomId(), msg.userId);
                this.userId = msg.userId;

                if (!isTransitionAllowed(this.currentState, States.READY)) return panic();
                this.currentState = States.READY;

                break;
            }
            case ReceiveSignallingTypes.OFFER: {
                if (this.currentState !== States.READY) return panic();
                if (!this.userId) return panic();

                const offer = new RTCSessionDescription(JSON.parse(msg.offer) as any);
                await this.rtcPeerConnection.setRemoteDescription(offer);

                await this.rtcPeerConnection.setLocalDescription(await this.rtcPeerConnection.createAnswer());

                if (!(await waitFor(() => this.rtcPeerConnection.iceGatheringState === 'complete'))) return panic();

                this.sendSignal({
                    toUserId: msg.fromUserId,
                    msg: {
                        type: ReceiveSignallingTypes.ANSWER,
                        fromUserId: this.userId,
                        answer: JSON.stringify(this.rtcPeerConnection.localDescription)
                    }
                });


                break;
            }
            case ReceiveSignallingTypes.ANSWER: {
                if (this.currentState !== States.READY) return panic();

                const answer = new RTCSessionDescription(JSON.parse(msg.answer) as any);
                await this.rtcPeerConnection.setRemoteDescription(answer);


                break;
            }
        }
    }

    async initRTCPeerConnection() {
        this.rtcPeerConnection.onconnectionstatechange = async () => {
            switch (this.rtcPeerConnection.connectionState) {
                case 'connected': {
                    if (this.currentState !== States.READY) return panic();

                    if (!isTransitionAllowed(this.currentState, States.CONNECTED)) return panic();
                    this.currentState = States.CONNECTED;
                    console.log('Connected');
                    break;
                }
                case 'closed': {
                }
                case 'disconnected': {
                    if (this.currentState !== States.CONNECTED) return panic();

                    if (!isTransitionAllowed(this.currentState, States.DISCONNECTED)) return panic();
                    this.currentState = States.DISCONNECTED;
                    console.log('Disconnected');
                    break;
                }
            }
        };
        this.rtcDataChannel = this.rtcPeerConnection.createDataChannel('data', {
            ordered: true,
            negotiated: true,
            id: 0
        });
        this.rtcSignallingChannel = this.rtcPeerConnection.createDataChannel('signal', {
            ordered: true,
            negotiated: true,
            id: 1
        });
    }


    async connect(toUserId: UserId) {
        if (this.currentState !== States.READY) return panic();
        if (!this.userId) return panic();


        await this.rtcPeerConnection.setLocalDescription(await this.rtcPeerConnection.createOffer());

        if (!(await waitFor(() => this.rtcPeerConnection.iceGatheringState === 'complete'))) return panic();

        this.sendSignal({
            toUserId: toUserId,
            msg: {
                type: ReceiveSignallingTypes.OFFER,
                fromUserId: this.userId,
                offer: JSON.stringify(this.rtcPeerConnection.localDescription),
            }
        });
    }
}

const initUIUpdate = (roomId: RoomId, userId: UserId) => {
    const [_, setUserId] = userIdSignal;
    const [__, setRoomId] = roomIdSignal;
    setUserId(userId);
    setRoomId(roomId);
};


export default Machine;

