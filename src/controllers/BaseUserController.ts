import { PickingInfo } from "@babylonjs/core/Collisions";
import { Nullable } from "@babylonjs/core/types";
import PlayerController from "./PlayerController";

export default abstract class BaseUserController {
    protected playerController: PlayerController;

    public abstract dispose(): void;
    public abstract updateController(hit: Nullable<PickingInfo>): void;

    constructor(playerController: PlayerController) {
        this.playerController = playerController;
    }
}