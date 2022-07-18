import { Nullable, PickingInfo } from "@babylonjs/core";
import PlayerController from "./PlayerController";

export default abstract class BaseUserController {
    protected playerController: PlayerController;

    public abstract dispose(): void;
    public abstract updateController(hit: Nullable<PickingInfo>): void;

    constructor(playerController: PlayerController) {
        this.playerController = playerController;
    }
}