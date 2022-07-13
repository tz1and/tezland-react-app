import { ActionManager, ExecuteCodeAction, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import PlayerController from "../controllers/PlayerController";
import ArtifactMemCache from "../utils/ArtifactMemCache";
import { AppControlFunctions, DirectoryFormProps, OverlayForm } from "./AppControlFunctions";


export default class TeleporterBooth extends TransformNode {
    private static AvailableBooths = [
        { id: -80074, filename: 'telebooth.glb', scale: 1.0 },
        { id: -80075, filename: 'telebooth_dengiskong_v2.glb', scale: 0.525 }
    ];

    constructor(pos: Vector3, scene: Scene, playerController: PlayerController, appControlFunctions: AppControlFunctions, isPure?: boolean) {
        super("Teleporter Booth", scene, isPure);
        this.position = pos;

        const chosen_booth = this.pickRandomBooth();
        this.scaling.multiplyInPlace(new Vector3(chosen_booth.scale, chosen_booth.scale, chosen_booth.scale));

        // TODO: Well, we should be using webpack for the booth models.
        ArtifactMemCache.loadOther(chosen_booth.id, chosen_booth.filename, scene, this).then(res => {
            res.getChildMeshes().forEach(c => {
                c.freezeWorldMatrix();

                if (c.name === "instance of ControlPanel") {
                    c.isPickable = true;
                    if (!c.actionManager) c.actionManager = new ActionManager(scene);

                    // TODO: OnPointerOverTrigger als thriggers through walls, maybe don't want that
                    // but OnPicked (or whatever) wasn't working for whatever reason.
                    c.actionManager.registerAction(
                        new ExecuteCodeAction(
                            {
                                trigger: ActionManager.OnPointerOverTrigger,
                            },
                            function () {
                                if (Vector3.Distance(playerController.getPosition(), c.absolutePosition) < 5)
                                    playerController.setCursor(1);
                            }
                        ))

                    c.actionManager.registerAction(
                        new ExecuteCodeAction(
                            {
                                trigger: ActionManager.OnPointerOutTrigger,
                            },
                            function () {
                                playerController.setCursor(0);
                            }
                        ))

                    c.actionManager.registerAction(
                        new ExecuteCodeAction(
                            {
                                trigger: ActionManager.OnPickDownTrigger
                            },
                            function () {
                                document.exitPointerLock();
                                appControlFunctions.loadForm(OverlayForm.Directory, {
                                    mapCoords: [pos.x, pos.z]
                                } as DirectoryFormProps);
                            }
                        ))
                }
            })
        })
    }

    private pickRandomBooth() {
        return TeleporterBooth.AvailableBooths[Math.floor(Math.random() * TeleporterBooth.AvailableBooths.length)];
    }

    // TODO: probably want to LOD the booths somehow.

    // TODO: needs some custom stuff for displying in inspector.
    /*public override getClassName(): string {
        return "ItemNode";
    }*/

    /*public updateLOD(camPos: DeepImmutable<Vector3>): boolean {
        const previousEnabled = this.isEnabled(false);
        let newEnabled = previousEnabled;

        // If the item is marked for removal it needs to be disabled.
        if (this.markForRemoval) {
            newEnabled = false;
        }
        // Otherwise, it depends on the distance.
        else {
            const distance = Vector3.Distance(camPos, this.absolutePosition);
            if (distance < 20) {
                newEnabled = true;
            }
            else {
                const scale = this.scaling.x;
                const alpha = Math.tanh(scale / distance);
                newEnabled = alpha > 0.04;
            }
        }

        // Update enabled if it needs to be.
        if (newEnabled !== previousEnabled) this.setEnabled(newEnabled);

        return newEnabled;
    }*/
}
