import { Color3 } from "@babylonjs/core";
import { TransformNode } from "@babylonjs/core/Meshes";
import { Game } from "./Game";

export abstract class BaseWorld {
    readonly game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    //public abstract loadWorld(): Promise<void>;

    public static FogSettings = {color: new Color3(0.7, 0.73, 0.8), density: 0.0001}

    public abstract getWorldNode(): TransformNode;

    public abstract dispose(): void;
}