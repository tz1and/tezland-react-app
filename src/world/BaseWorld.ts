import { Game } from "./Game";

export abstract class BaseWorld {
    readonly game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    //public abstract loadWorld(): Promise<void>;

    public abstract dispose(): void;
}