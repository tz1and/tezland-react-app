import assert from 'assert';
import Conf from '../Config';
//import EventEmitter from 'events';
import { World } from './World';
import {  Constants, DynamicTexture, Mesh, MeshBuilder, Nullable,
    StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { fromHexString, toHexString, truncate } from '../utils/Utils';
import crypto from 'crypto';
import { Logging } from '../utils/Logging';


export default class MultiplayerClient { //extends EventEmitter {
    public static UpdateInterval = 100;

    private ws: WebSocket;
    private world: World;
    private otherPlayersNode: Nullable<TransformNode>;
    private otherPlayers: Map<string, OtherPlayer> = new Map();

    private _connected: boolean;
    get connected(): boolean { return this._connected; }

    private identity?: string | undefined;

    constructor(world: World) {
        //super(); // event emitter

        this.world = world;
        this._connected = false;

        this.otherPlayersNode = null;

        this.ws = this.connect();
    }

    private static readonly reconnectInterval = 10 * 1000;

    private connect(): WebSocket {
        assert(!this.otherPlayersNode);

        const ws = new WebSocket(Conf.multiplayer_url);

        this.otherPlayersNode = new TransformNode("multiplayerPlayers", this.world.scene);

        this.identity = this.world.walletProvider.isWalletConnected() ?
            this.world.walletProvider.walletPHK() : crypto.randomBytes(32).toString('hex');

        ws.onopen = () => {
            this.handshake();
        };

        ws.onmessage = (msg) => {
            this.handleMessage(msg);
        };

        ws.onerror = (ev) => {
            Logging.InfoDev('MultiplayerClient: Socket error: ', ev); // TODO: figure out how to get msg
        };

        ws.onclose = () => {
            // If the other side closed.
            this.dispose(); // TODO: should call dispose here, not disconnect
            this._connected = false;
            Logging.InfoDev('MultiplayerClient: Connection terminated. Reconnecting...');
            setTimeout(() => { this.ws = this.connect() }, MultiplayerClient.reconnectInterval);
        };

        return ws;
    };

    private handshake() {
        const auth = { msg: "hello", user: this.identity };
        this.ws.send(JSON.stringify(auth));
    }

    private handleMessage(message: MessageEvent<any>) {
        //Logging.Log('received: %s', message.data);

        try {
            const msgObj = JSON.parse(message.data.toString());

            var res = null;
            switch(msgObj.msg) {
                case "challenge":
                    res = this.challengeResponse(msgObj.challenge);
                    break;

                case "authenticated":
                    this._connected = true;
                    break;

                case "error":
                    Logging.Error(msgObj.desc);
                    // server may close after sending error.
                    break;

                case "position-updates":
                    this.updateOtherPlayers(msgObj.updates);
                    break;

                default:
                    throw new Error("Unhandled message type");
            }

            if(res) this.ws.send(JSON.stringify(res));
        } catch(err) {
            Logging.Error("Error handling server response: " + err);
        }
    }

    private challengeResponse(challenge: string): any {
        return { msg: "challenge-response",
            // TODO:
            //response: this.world.walletProvider.signMessage(challenge)
            response: "OK"
        }
    }

    private updateOtherPlayers(updates: any) {
        assert(this.otherPlayersNode);

        if(updates.length === 0) return;

        //const start_time = performance.now();

        updates.forEach((u: any) => {
            // skip currently connected player.
            if (this.identity === u.name) return;

            // handle disconnect messages.
            if(u.dc === true) {
                let p = this.otherPlayers.get(u.name);
                if(p) {
                    p.dispose();
                    this.otherPlayers.delete(u.name);
                }
                return;
            }

            // otherwise it's an update
            let p = this.otherPlayers.get(u.name);
            if(!p) {
                p = new OtherPlayer(u.name, this.otherPlayersNode!);
                this.world.shadowGenerator?.addShadowCaster(p.head);
                this.world.shadowGenerator?.addShadowCaster(p.body);
                this.otherPlayers.set(u.name, p);
            }
            p.update(u.upd);
        });

        //const elapsed = performance.now() - start_time;
        //Logging.Log(`update other players took: ${elapsed}ms`);
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

    public interpolateOtherPlayers() {
        if(this.otherPlayers.size === 0) return;

        //const start_time = performance.now();

        // assume 60 fps.
        const time_since_last_frame = 1 / 60;
        const time = time_since_last_frame / 0.2;

        this.otherPlayers.forEach((p) => {
            p.interpolate(time);
        })

        //const elapsed = performance.now() - start_time;
        //Logging.Log(`interpolating players took: ${elapsed}ms`);
    }

    private dispose() {
        this.otherPlayers.clear();
        this.otherPlayersNode?.dispose();
        this.otherPlayersNode = null;
    }

    // todo: split into dispose/disconnect
    public disconnectAndDispose() {
        this.ws.close();
        // TODO: figure out if I need to close this...
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this._connected = false;

        this.dispose();

        Logging.LogDev('MultiplayerClient: Socket closed.');
    }
}

class OtherPlayer {
    readonly head: Mesh;
    readonly body: Mesh;
    readonly nameplate: Mesh;
    readonly tranformNode: TransformNode;

    public lastPos: Vector3;
    public lastRot: Vector3;

    private makeBillboard(name: string, parent: TransformNode) {
        const scene = parent.getScene();

        const res_h = 64;
        var text: string;
        var aspect_ratio: number;
        if (name.startsWith('tz1')) {
            aspect_ratio = 1/7;
            text = truncate(name, 12, '\u2026');
        }
        else {
            aspect_ratio = 1 / 2.8;
            text = "Guest";
        }

        // TODO: calculate lentgh of text in pixels!

        // TODO: store dynamic texture and material for dispose?
        var dynamicTexture = new DynamicTexture("NameplateTexture", {width: res_h / aspect_ratio, height: res_h}, scene, true);
        dynamicTexture.hasAlpha = true;
        dynamicTexture.getContext().fillStyle = 'transparent';
        dynamicTexture.drawText(text, 1, res_h - 2, `${res_h}px Arial`, "white", "transparent", true);

        const mat = new StandardMaterial("NameplateMaterial", scene);
        //mat.diffuseTexture = dynamicTexture;
        mat.alphaMode = Constants.ALPHA_MULTIPLY;
        mat.emissiveTexture = dynamicTexture;
        mat.disableLighting = true;

        const plane = MeshBuilder.CreatePlane("Nameplate", {width: 0.2 / aspect_ratio, height: 0.2}, scene);
        //const plane = Mesh.CreatePlane("Nameplate", 0.5, scene, true);
        plane.parent = this.tranformNode;
        //plane.material.backFaceCulling = false;
        plane.material = mat;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.addLODLevel(10, null);

        return plane;
    };

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

        this.nameplate = this.makeBillboard(name, this.tranformNode);
        this.nameplate.position.y = 0.5;

        this.tranformNode.parent = parent;

        this.lastPos = new Vector3(0,0,0);
        this.lastRot = new Vector3(0,0,0);

        Logging.LogDev("MultiplayerClient: added player", name)
    }

    update(tranformData: string) {
        assert(tranformData.length === 48)
        const uints = fromHexString(tranformData);
        const view = new DataView(uints.buffer)
        this.lastPos.set(view.getFloat32(0), view.getFloat32(4), view.getFloat32(8));
        this.lastRot.set(view.getFloat32(12), view.getFloat32(16), view.getFloat32(20));
    }

    interpolate(delta: number) {
        this.tranformNode.position = Vector3.Lerp(this.tranformNode.position, this.lastPos, delta);
        this.head.rotation = Vector3.Lerp(this.head.rotation, this.lastRot, delta);
    }

    dispose() {
        this.tranformNode.dispose();
    }
}