import Conf from '../Config';
import {  Constants, DynamicTexture, Mesh, MeshBuilder, Nullable,
    StandardMaterial, TransformNode, Vector3 } from '@babylonjs/core';
import { truncateAddress } from '../utils/TezosUtils';
import { Logging } from '../utils/Logging';
import { Game } from './Game';
import * as Colyseus from "colyseus.js";
import crypto from 'crypto';
import { MapSchema, Schema, DataChange, type } from "@colyseus/schema";
import { ChatMessage } from './AppControlFunctions';
import EventBus, { ChatMessageEvent, ChatRoomEvent, SendChatMessageEvent } from '../utils/eventbus/EventBus';

export class Player extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;

    @type("number") rot_x: number = 0;
    @type("number") rot_y: number = 0;
    @type("number") rot_z: number = 0;

    @type("string") name: string = "";
}

export class tz1RoomState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
}


// TODO: detect connection dropped and reconnect somehow.


export default class MultiplayerClient { //extends EventEmitter {
    public static UpdateInterval = 50;

    private client: Colyseus.Client;
    private currentRoom: Nullable<Colyseus.Room<tz1RoomState>>;

    private playerSessionId: string = "";

    private game: Game;
    private otherPlayersNode: TransformNode;
    private otherPlayers: Map<string, OtherPlayer> = new Map();

    private readOnlyClient: boolean;

    private identity: string;

    constructor(game: Game, readOnlyClient: boolean = false) {
        //super(); // event emitter

        this.game = game;
        this.readOnlyClient = readOnlyClient;

        this.client = new Colyseus.Client(Conf.multiplayer_url);
        this.currentRoom = null;

        this.otherPlayersNode = new TransformNode("multiplayerPlayers", this.game.scene);

        this.identity = this.getIdentity();

        EventBus.subscribe("send-chat-message", this.sendChatMessage);
    }

    private lastMultiplayerUpdate: number = 0;

    public updateMultiplayer() {
        // Occasionally send player postition.
        const now = performance.now();
        const elapsed = now - this.lastMultiplayerUpdate;
        if(!this.game.playerController.flyMode && elapsed > MultiplayerClient.UpdateInterval) {
            this.lastMultiplayerUpdate = now;

            this.game.multiClient.updatePlayerPosition(
                this.game.playerController.getPosition(),
                this.game.playerController.getRotation()
            );
        }

        // interpolate other players
        this.game.multiClient.interpolateOtherPlayers();
    }

    public async changeRoom(room: string, options?: any) {
        try {
            if(this.currentRoom) {
                EventBus.publish("chat-message", new ChatMessageEvent(
                    {from: null, msg: "You left " + this.currentRoom.name}));
                await this.currentRoom.leave();
                // Delete other players.
                this.otherPlayers.forEach(p => p.dispose());
                this.otherPlayers.clear();
                this.currentRoom = null;
            }

            const newRoom = await this.client.joinOrCreate<tz1RoomState>(room, options);
            console.log(newRoom.sessionId, "joined", newRoom.name);
            this.currentRoom = newRoom;
            this.playerSessionId = this.currentRoom.sessionId;
            EventBus.publish("chat-message", new ChatMessageEvent(
                {from: null, msg: "You joined " + this.currentRoom.name}));

            this.currentRoom.onMessage<ChatMessage>("messages", msg => EventBus.publish("chat-message", new ChatMessageEvent(msg)));// this.onChatMessage);

            //this.currentRoom.onStateChange(this.roomStateChanged)
            this.currentRoom.state.players.onAdd = this.playerJoin;
            this.currentRoom.state.players.onRemove = this.playerLeave;

            // send current player state
            this.updatePlayerPosition(this.last_pos, this.last_rot);
            this.updatePlayerIdentity();
        } catch(e) {
            console.log("Failed to switch room", e);
        }
    }

    private isPlayer(sessionId: string) {
        return (sessionId === this.playerSessionId);
    }

    private playerJoin = (player: Player, sessionId: string) => {
        if (this.currentRoom) EventBus.publish("chat-room", new ChatRoomEvent(this.currentRoom.state));

        if(this.isPlayer(sessionId)) return;

        const p = new OtherPlayer(player, sessionId, this.otherPlayersNode);
        this.otherPlayers.set(sessionId, p);
        p.updateNextTransform();
        p.moveToNext();
        Logging.LogDev("MultiplayerClient: player connected:", sessionId);
    }

    private playerLeave = (player: Player, sessionId: string) => {
        if (this.currentRoom) EventBus.publish("chat-room", new ChatRoomEvent(this.currentRoom.state));

        if(this.isPlayer(sessionId)) return;

        const p = this.otherPlayers.get(sessionId);
        if(p) {
            this.otherPlayers.delete(sessionId);
            p.dispose();
            Logging.LogDev("MultiplayerClient: player disconnected:", sessionId);
        }
    }

    // We don't really need to handle incoming chat messages here.
    /*private onChatMessage = (msg: ChatMessage) => {
        this.game.appControl.newChatMessage.dispatch(msg);
        //console.log(`${msg.from ? msg.from : "System"}: ${msg.msg}`)
    }*/

    private getIdentity(): string {
        const anon = !this.game.walletProvider.isWalletConnected();
        return anon ? "Guest-" + crypto.randomBytes(3).toString('hex') : this.game.walletProvider.walletPHK();
    }

    private last_pos = new Vector3();
    private last_rot = new Vector3();

    public updatePlayerPosition(pos: Vector3, rot: Vector3) {
        // dont send update if nothing changed.
        if (this.last_pos.equalsWithEpsilon(pos) && this.last_rot.equalsWithEpsilon(rot))
            return;

        // update last pos.
        this.last_pos.copyFrom(pos);
        this.last_rot.copyFrom(rot);

        if(this.currentRoom) {
            this.currentRoom.send("updatePosition", {
                x: pos.x,
                y: pos.y,
                z: pos.z,
                rot_x: rot.x,
                rot_y: rot.y,
                rot_z: rot.z,
            });
        }
    }

    public updatePlayerIdentity() {
        this.identity = this.getIdentity();

        if(this.currentRoom) {
            this.currentRoom.send("updateName", {
                name: this.identity
            });
        }
    }

    private sendChatMessage = (e: SendChatMessageEvent) => {
        if(this.currentRoom) this.currentRoom.send("message", e.msg);
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

    public dispose() {
        this.currentRoom?.connection.close();
        this.otherPlayers.clear();
        this.otherPlayersNode.dispose();

        EventBus.unsubscribe("send-chat-message", this.sendChatMessage);
    }
}

class OtherPlayer {
    private player: Player;

    readonly head: Mesh;
    readonly body: Mesh;
    private nameplate: Mesh;
    readonly tranformNode: TransformNode;

    public nextPos: Vector3;
    public nextRot: Vector3;
    public name: string;

    private makeBillboard(name: string, parent: TransformNode) {
        const scene = parent.getScene();

        const res_h = 64;
        var text: string;
        var aspect_ratio: number;
        if (name.startsWith('tz1')) {
            aspect_ratio = 1/9;
            text = truncateAddress(name);
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
        dynamicTexture.drawText(text, 2, res_h - 5, `${res_h}px Arial`, "white", "transparent", true);

        const mat = new StandardMaterial("NameplateMaterial", scene);
        mat.diffuseTexture = dynamicTexture;
        mat.emissiveTexture = dynamicTexture;
        mat.alphaMode = Constants.ALPHA_MULTIPLY;
        mat.disableLighting = true;

        const plane = MeshBuilder.CreatePlane("Nameplate", {width: 0.1 / aspect_ratio, height: 0.1, updatable: false}, null);
        //const plane = Mesh.CreatePlane("Nameplate", 0.5, scene, true);
        plane.parent = this.tranformNode;
        //plane.material.backFaceCulling = false;
        plane.material = mat;
        plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
        plane.addLODLevel(10, null);

        plane.isPickable = false;
        plane.position.y = 1.8 + 0.25; // TODO: don't hardocde this

        return plane;
    };

    constructor(player: Player, name: string, parent: TransformNode) {
        this.player = player;
        this.player.onChange = this.dataChange;

        this.name = name;

        this.tranformNode = new TransformNode(name);
        this.head = MeshBuilder.CreateBox("head", {size: 0.4}, null);
        this.head.isPickable = false;
        this.head.parent = this.tranformNode;
        this.head.position.y = 1.8 - 0.15; // TODO: don't hardocde this

        const nose = MeshBuilder.CreateBox("nose", {size: 0.075}, null);
        nose.isPickable = false;
        nose.parent = this.head;
        nose.position.z = 0.225;

        this.body = MeshBuilder.CreateCylinder("body", {height: 0.8, diameterTop: 0.75, diameterBottom: 0.75, tessellation: 12}, null);
        this.body.isPickable = false;
        this.body.parent = this.tranformNode;
        this.body.position.y = 0.95; // TODO: don't hardocde this

        this.nameplate = this.makeBillboard(name, this.tranformNode);

        this.tranformNode.parent = parent;

        this.nextPos = new Vector3(0,0,0);
        this.nextRot = new Vector3(0,0,0);
    }

    updateNextTransform() {
        this.nextPos.set(this.player.x, this.player.y, this.player.z);
        this.nextRot.set(this.player.rot_x, this.player.rot_y, this.player.rot_z);
    }

    dataChange = (changes: DataChange<any>[]) => {
        this.updateNextTransform();
        changes.forEach(c => {
            if(c.field === 'name') {
                this.name = c.value as string;
                this.nameplate.dispose();
                this.nameplate = this.makeBillboard(this.name, this.tranformNode);
            }
        });
    }

    moveToNext() {
        this.tranformNode.position.copyFrom(this.nextPos);
        this.head.rotation.copyFrom(this.nextRot);
    }

    interpolate(delta: number) {
        // when player moves far, for example when teleporting, don't interpolate.
        if (Vector3.Distance(this.tranformNode.position, this.nextPos) > 10) {
            this.moveToNext();
            return;
        }

        // TODO: use delta time?
        this.tranformNode.position = Vector3.Lerp(this.tranformNode.position, this.nextPos, 0.05);
        this.head.rotation = Vector3.Lerp(this.head.rotation, this.nextRot, 0.05);
    }

    dispose() {
        this.player.onChange = undefined;
        this.tranformNode.dispose();
    }
}