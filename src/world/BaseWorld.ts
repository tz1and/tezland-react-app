import { TransformNode } from "@babylonjs/core/Meshes";
import { Game } from "./Game";

export abstract class BaseWorld {
    readonly game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    //public abstract loadWorld(): Promise<void>;

    public abstract getWorldNode(): TransformNode;

    public abstract dispose(): void;
}