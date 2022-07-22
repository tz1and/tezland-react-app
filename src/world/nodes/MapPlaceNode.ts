import { Mesh, Nullable,
    Vector3, Color4 } from "@babylonjs/core";
import { bytes2Char } from "@taquito/utils";
import { PlaceData } from "../PlaceNode";
import { WorldMap } from "../WorldMap";
import { MeshUtils } from "../../utils/MeshUtils";
import { PublicPlaces } from "../../worldgen/PublicPlaces";
import BasePlaceNode from "./BasePlaceNode";
import { PlaceTokenMetadata } from "../Metadata";


export default class MapPlaceNode extends BasePlaceNode {
    // TODO: remove placeData, don't need it.
    public placeData: Nullable<PlaceData> = null;
    private placeBounds: Nullable<Mesh> = null;

    constructor(placeId: number, placeMetadata: PlaceTokenMetadata, worldMap: WorldMap) {
        super(placeId, placeMetadata, worldMap);

        this.initialisePlace();
    }

    public override dispose() {
        // TODO: have some flag if it's loading right now or something.
        this.placeBounds?.dispose();
        this.placeBounds = null;

        super.dispose();
    }

    private initialisePlace() {
        var shape = new Array<Vector3>();
        this.placeMetadata.borderCoordinates.forEach((v: Array<number>) => {
            shape.push(Vector3.FromArray(v));
        });

        // TODO: make sure the place coordinates are going right around!
        shape = shape.reverse();

        this.position.copyFrom(this._origin); // TODO: move to base constructor?

        const isPublic = PublicPlaces.has(this.placeId);

        // create bounds
        this.placeBounds = MeshUtils.extrudeMeshFromShape(shape, this._buildHeight - 0.1, new Vector3(0, this._buildHeight, 0),
            isPublic ? (this.world as WorldMap).transparentGridMatPublic : (this.world as WorldMap).transparentGridMat, 'bounds', this.world.scene, undefined, true)

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

    public getName() {
        if (this.placeData) {
            const place_name = this.placeData.place_props.get('01');
            if (place_name) return bytes2Char(place_name);
        }

        return `Place #${this.placeId}`;
    }
}