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
            this.world.walletProvider.walletPHK() : crypto.randomBytes(18).toString('hex');

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
                    this.otherPlayers.delete(u.name);
                    p.dispose();
                    Logging.LogDev("MultiplayerClient: player disconnected:", u.name);
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
                p.update(u.upd);
                p.moveToLast();
                Logging.LogDev("MultiplayerClient: player connected:", u.name);
            }
            else p.update(u.upd);
        });

        //const elapsed = performance.now() - start_time;
        //Logging.Log(`update other players took: ${elapsed}ms`);
    }

    private last_pos = new Vector3();
    private last_rot = new Vector3();

    public updatePlayerPosition(pos: Vector3, rot: Vector3) {
        assert(this.ws && this.ws.readyState === WebSocket.OPEN, "Not connected");
        assert(this.connected, "Not authenticated");

        // dont send update if nothing changed.
        if (this.last_pos.equalsWithEpsilon(pos) && this.last_rot.equalsWithEpsilon(this.last_rot))
            return;

        // update last pos.
        this.last_pos.copyFrom(pos);
        this.last_rot.copyFrom(rot);

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
            aspect_ratio = 1/7.2;
            text = truncate(name, 12, '\u2026'); // TODO: use truncateAddress
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
        mat.diffuseTexture = dynamicTexture;
        mat.emissiveTexture = dynamicTexture;
        mat.alphaMode = Constants.ALPHA_MULTIPLY;
        mat.disableLighting = true;

        const plane = MeshBuilder.CreatePlane("Nameplate", {width: 0.2 / aspect_ratio, height: 0.2, updatable: false}, null);
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
        this.head = Mesh.CreateBox("head", 0.4, null, false);
        this.head.isPickable = false;
        this.head.parent = this.tranformNode;
        this.head.position.y = 1.8 - 0.15; // TODO: don't hardocde this

        const nose = Mesh.CreateBox("nose", 0.075, null, false);
        nose.isPickable = false;
        nose.parent = this.head;
        nose.position.z = 0.225;

        this.body = Mesh.CreateCylinder("body", 0.8, 0.75, 0.75, 12, null, undefined, false);
        this.body.isPickable = false;
        this.body.parent = this.tranformNode;
        this.body.position.y = 0.95; // TODO: don't hardocde this

        this.nameplate = this.makeBillboard(name, this.tranformNode);
        this.nameplate.isPickable = false;
        this.nameplate.position.y = 1.8 + 0.5; // TODO: don't hardocde this

        this.tranformNode.parent = parent;

        this.lastPos = new Vector3(0,0,0);
        this.lastRot = new Vector3(0,0,0);
    }

    update(tranformData: string) {
        assert(tranformData.length === 48)
        const uints = fromHexString(tranformData);
        const view = new DataView(uints.buffer)
        this.lastPos.set(view.getFloat32(0), view.getFloat32(4), view.getFloat32(8));
        this.lastRot.set(view.getFloat32(12), view.getFloat32(16), view.getFloat32(20));
    }

    moveToLast() {
        this.tranformNode.position = this.lastPos;
        this.head.rotation = this.lastRot;
    }

    interpolate(delta: number) {
        // when player moves far, for example when teleporting, don't interpolate.
        if (Vector3.Distance(this.tranformNode.position, this.lastPos) > 10) {
            this.moveToLast();
            return;
        }

        this.tranformNode.position = Vector3.Lerp(this.tranformNode.position, this.lastPos, delta);
        this.head.rotation = Vector3.Lerp(this.head.rotation, this.lastRot, delta);
    }

    dispose() {
        this.tranformNode.dispose();
    }
}