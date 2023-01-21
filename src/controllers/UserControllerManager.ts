import { PickingInfo } from "@babylonjs/core/Collisions";
import { Nullable } from "@babylonjs/core/types";
import BaseUserController from "./BaseUserController";
import ItemPickingController from "./ItemPickingController";
import ItemPlacementController from "./ItemPlacementController";
import PlayerController from "./PlayerController";


export default class UserControllerManager {
    static registry: Map<string, new(playerController: PlayerController) => BaseUserController> = new Map();

    public static register(name: string, construct: new(playerController: PlayerController) => BaseUserController) {
        this.registry.set(name, construct);
    }

    private activeController: BaseUserController | null;

    constructor() {
        UserControllerManager.register("picking", ItemPickingController);
        UserControllerManager.register("placement", ItemPlacementController);

        this.activeController = null;
    }

    // TODO: activate by passing constructor instead. Remove registry.
    public activate<T extends BaseUserController>(name: string, playerController: PlayerController): T {
        this.deactivate();

        const controllerConstructor = UserControllerManager.registry.get(name);
        if (!controllerConstructor) throw new Error(`No regstered user controller '${name}'`);

        this.activeController = new controllerConstructor(playerController);
        return this.activeController as T;
    }

    public deactivate() {
        if (this.activeController) {
            this.activeController.dispose();
            this.activeController = null;
        }
    }

    public updateController(hit: Nullable<PickingInfo>) {
        if (this.activeController)
            this.activeController.updateController(hit);
    }
}