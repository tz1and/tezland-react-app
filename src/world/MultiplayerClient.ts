import assert from 'assert';
import Conf from '../Config';
import EventEmitter from 'events';
import { World } from './World';
import { Mesh, Nullable, TransformNode, Vector3 } from '@babylonjs/core';
import { fromHexString, toHexString } from '../utils/Utils';
import crypto from 'crypto';


export default class MultiplayerClient extends EventEmitter {
    public static UpdateInterval = 500;

    private ws: WebSocket;
    private world: World;
    private otherPlayersNode: Nullable<TransformNode>;

    private _connected: boolean;
    get connected(): boolean { return this._connected; }

    private identity?: string | undefined;

    constructor(world: World) {
        super();

        this.world = world;
        this._connected = false;

        this.otherPlayersNode = null;

        this.ws = this.connect();
    }

    private static readonly reconnectInterval = 10 * 1000;

    private connect(): WebSocket {
        assert(!this.otherPlayersNode);

        // TODO: can throw! catch
        const ws = new WebSocket(Conf.multiplayer_url);

        this.otherPlayersNode = new TransformNode("multiplayerPlayers", this.world.scene);

        const walletPHK = this.world.walletProvider.walletPHK();
        this.identity = walletPHK ? walletPHK : crypto.randomBytes(64).toString('hex');

        ws.onopen = () => {
            this.handshake();
        };

        ws.onmessage = (msg) => {
            this.handleMessage(msg);
        };

        ws.onerror = (ev) => {
            console.log('MultiplayerClient: Socket error: ', ev); // TODO: figure out how to get msg
        };

        ws.onclose = () => {
            console.log('MultiplayerClient: Socket closed. Reconnecting...');
            // Emit reqHandled event, in case TradeBot is still waiting. TODO: fix this properly!
            this.emit('reqHandled', []);
            this._connected = false;
            setTimeout(() => { this.ws = this.connect() }, MultiplayerClient.reconnectInterval);
        };

        return ws;
    };

    private handshake() {
        const auth = { msg: "hello", user: this.identity };
        this.ws.send(JSON.stringify(auth));
    }

    private handleMessage(message: MessageEvent<any>) {
        //console.log('received: %s', message.data);

        try {
            const msgObj = JSON.parse(message.data.toString());

            var res = null;
            switch(msgObj.msg) {
                case "challenge":
                    res = this.challengeResponse(msgObj.challenge);
                    break;

                case "authenticated":
                    res = null;
                    this._connected = true;
                    break;

                case "auth-failed":
                    this._connected = false;
                    throw new Error("Authentication failed");

                case "error":
                    this.emit('reqHandled', []);
                    break;

                case "position-updates":
                    this.updateOtherPlayers(msgObj.updates);
                    break;

                default:
                    throw new Error("Unhandled message type");
            }

            if(res) this.ws.send(JSON.stringify(res));
        } catch(e) {
            console.log("Failed to parse: " + e);
        }
    }

    private challengeResponse(challenge: string): any {
        return { msg: "challenge-response",
            // TODO:
            //response: this.world.walletProvider.signMessage(challenge)
            response: "OK"
        }
    }

    private otherPlayers: Map<string, OtherPlayer> = new Map();

    private updateOtherPlayers(updates: any) {
        assert(this.otherPlayersNode);

        updates.forEach((u: any) => {
            // skip currently connected player.
            if (this.world.walletProvider.walletPHK() === u.name) return;

            let p = this.otherPlayers.get(u.name);
            if(!p) {
                p = new OtherPlayer(u.name, this.otherPlayersNode!);
                this.otherPlayers.set(u.name, p);
            }
            p.update(u.upd);
        })
    }

    public updatePlayerPosition(pos: Vector3, rot: Vector3) {
        assert(this.ws && this.ws.readyState === WebSocket.OPEN, "Not connected");
        assert(this.connected, "Not authenticated");

        // TODO: optimize this. Write some tests.
        const from_float32 = (data: Float32Array) => {
            const uints = new Uint8Array(data.length * 4);
            const view = new DataView(uints.buffer);
            for (let i = 0; i < data.length; ++i)
                view.setFloat32(i * 4, data[i]);
            return toHexString(uints);
        }

        const tdata = Float32Array.from(pos.asArray().concat(rot.asArray()));

        const req = {
            msg: "upd",
            upd: from_float32(tdata)
        };

        this.ws.send(JSON.stringify(req));

        // server doesn't respond to update position
    }

    // todo: rename dispose.
    public disconnect() {
        // TODO: figure out if I need to close this...
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close()

        this.otherPlayers.clear();
        this.otherPlayersNode?.dispose();

        console.log('MultiplayerClient: Socket closed.');
    }
}

class OtherPlayer {
    public head: Mesh;
    public body: Mesh;
    public tranformNode: TransformNode;

    constructor(name: string, parent: TransformNode) {
        this.tranformNode = new TransformNode(name);
        this.head = Mesh.CreateBox("head", 0.5, null);
        this.head.parent = this.tranformNode;

        const nose = Mesh.CreateBox("nose", 0.1, null);
        nose.parent = this.head;
        nose.position.z = 0.3;

        this.body = Mesh.CreateCylinder("body", 1, 0.9, 0.9, 12, null);
        this.body.parent = this.tranformNode;
        this.body.position.y = -0.85;

        this.tranformNode.parent = parent;
    }

    update(tranformData: string) {
        assert(tranformData.length === 48)
        const uints = fromHexString(tranformData);
        const view = new DataView(uints.buffer)
        this.tranformNode.position.set(view.getFloat32(0), view.getFloat32(4), view.getFloat32(8));
        this.tranformNode.rotation.set(view.getFloat32(12), view.getFloat32(16), view.getFloat32(20));
    }
}