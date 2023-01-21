import { Mesh, TransformNode } from "@babylonjs/core/Meshes";
import { Color4, Vector3 } from "@babylonjs/core/Maths";
import { Nullable } from "@babylonjs/core/types";
import { WorldMap } from "./WorldMap";
import { MeshUtils } from "../../utils/MeshUtils";
import { PublicPlaces } from "../../worldgen/PublicPlaces";
import { PlaceTokenMetadata } from "../Metadata";
import { Logging } from "../../utils/Logging";
import Contracts from "../../tz/Contracts";
import Conf from "../../Config";
import PlaceKey from "../../utils/PlaceKey";


export default class MapPlaceNode extends TransformNode {
    readonly placeKey: PlaceKey;
    readonly placeMetadata: PlaceTokenMetadata;
    protected worldMap: WorldMap;

    protected _origin: Vector3;
    get origin(): Vector3 { return this._origin.clone(); }

    protected _buildHeight;
    get buildHeight(): number { return this._buildHeight; }

    get currentOwner(): string { return this.owner; }
    protected owner: string = "";
    protected last_owner_update = 0;

    private placeBounds: Nullable<Mesh> = null;

    constructor(placeId: number, placeMetadata: PlaceTokenMetadata, worldMap: WorldMap) {
        super(`placeRoot${placeId}`, worldMap.scene);

        this.worldMap = worldMap;

        this.placeKey = new PlaceKey(placeId, Conf.place_contract);
        this.placeMetadata = placeMetadata;

        this._origin = Vector3.FromArray(this.placeMetadata.centerCoordinates);
        this._buildHeight = this.placeMetadata.buildHeight;

        this.initialisePlace();
    }

    public override dispose(doNotRecurse?: boolean | undefined, disposeMaterialAndTextures?: boolean | undefined): void {
        // TODO: have some flag if it's loading right now or something.
        this.placeBounds?.dispose();
        this.placeBounds = null;

        super.dispose(doNotRecurse, disposeMaterialAndTextures);
    }

    private initialisePlace() {
        var shape = new Array<Vector3>();
        this.placeMetadata.borderCoordinates.forEach((v: Array<number>) => {
            shape.push(Vector3.FromArray(v));
        });

        // TODO: make sure the place coordinates are going right around!
        shape = shape.reverse();

        this.position.copyFrom(this._origin); // TODO: move to base constructor?

        const isPublic = PublicPlaces.has(this.placeKey.id);

        // create bounds
        this.placeBounds = MeshUtils.extrudeMeshFromShape(shape, this._buildHeight - 0.1, new Vector3(0, this._buildHeight, 0),
            isPublic ? this.worldMap.transparentGridMatPublic : this.worldMap.transparentGridMat, 'bounds', this.worldMap.scene, undefined, true)

        // enable edge rendering
        this.placeBounds.enableEdgesRendering();
        this.placeBounds.edgesWidth = 5;
        if (isPublic) this.placeBounds.edgesColor = new Color4(0, 0.7, 0.3, 0.8);
        else this.placeBounds.edgesColor = new Color4(0, 0.3, 0.7, 0.8);

        this.placeBounds.parent = this;
        // Call getHierarchyBoundingVectors to force updating the bounding info!
        // TODO: figure out if still needed.
        this.placeBounds.getHierarchyBoundingVectors();
        this.placeBounds.freezeWorldMatrix();
    }

    /**
     * Updates the place owner and permissions.
     * @param force force update, ignoring validity.
     * @param validity validity of information in seconds.
     */
     public async updateOwner(force: boolean = false, validity: number = 60) {
        // Update owner and permissions, if they weren't updated recently.
        // TODO: the rate limiting here is a bit wonky - it breaks when there was an error fetching the owner.
        // Maybe reset last_owner_and_permission_update on failiure?
        if(force || (Date.now() - (validity * 1000)) > this.last_owner_update) {
            const prev_update = this.last_owner_update;
            Logging.InfoDev("Updating owner for place " + this.placeKey.id);
            try {
                this.last_owner_update = Date.now();
                this.owner = await Contracts.getPlaceOwner(this.placeKey);
            }
            catch(reason: any) {
                this.last_owner_update = prev_update;
                Logging.InfoDev("Failed to load ownership for place " + this.placeKey.id);
                Logging.InfoDev(reason);
            }
        }
    }
}