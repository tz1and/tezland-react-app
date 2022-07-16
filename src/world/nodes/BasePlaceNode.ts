import { TransformNode, Vector3 } from "@babylonjs/core";
import Contracts from "../../tz/Contracts";
import { Logging } from "../../utils/Logging";
import { yesNo } from "../../utils/Utils";
import { WorldInterface } from "../WorldInterface";


export type PlaceId = number;


export class PlacePermissions {
    private _permissions: number;

    // should mirror the permissions from TL_World contract.
    public static permissionNone: number       = 0;
    public static permissionPlaceItems: number = 1;
    public static permissionModifyAll: number  = 2;
    public static permissionProps: number      = 4;
    //public static permissionCanSell: number    = 8;
    public static permissionFull: number       = 7; // 15 with CanSell

    constructor(permissions: number) {
        this._permissions = permissions;
    }

    public get permissions(): number { return this._permissions; }

    public hasAny() { return this._permissions !== PlacePermissions.permissionNone; }
    public hasPlaceItems() { return (this._permissions & PlacePermissions.permissionPlaceItems) === PlacePermissions.permissionPlaceItems; }
    public hasModifyAll() { return (this._permissions & PlacePermissions.permissionModifyAll) === PlacePermissions.permissionModifyAll; }
    public hasProps() { return (this._permissions & PlacePermissions.permissionProps) === PlacePermissions.permissionProps; }
    public hasFull() { return (this._permissions & PlacePermissions.permissionFull) === PlacePermissions.permissionFull; }

    public toString(): string {
        if (!this.hasAny()) return "None";
        if (this.hasFull()) return "Full";

        return `PlaceItems:${yesNo(this.hasPlaceItems())}, ModifyAll:${yesNo(this.hasModifyAll())}, Props:${yesNo(this.hasProps())}`;
    }
};


export default abstract class BasePlaceNode extends TransformNode {
    readonly placeId: number;
    readonly placeMetadata: any;
    protected world: WorldInterface;

    protected _origin: Vector3;
    get origin(): Vector3 { return this._origin.clone(); }

    protected _buildHeight;
    get buildHeight(): number { return this._buildHeight; }

    get getPermissions(): PlacePermissions { return this.permissions; }
    get currentOwner(): string { return this.owner; }
    protected owner: string = "";
    protected permissions: PlacePermissions = new PlacePermissions(PlacePermissions.permissionNone);
    protected last_owner_and_permission_update = 0;

    constructor(placeId: number, placeMetadata: any, world: WorldInterface) {
        super(`placeRoot${placeId}`, world.scene);

        this.world = world;

        this.placeId = placeId;
        this.placeMetadata = placeMetadata;

        this._origin = Vector3.FromArray(this.placeMetadata.centerCoordinates);
        this._buildHeight = this.placeMetadata.buildHeight;
    }

    /**
     * Updates the place owner and permissions.
     * @param force force update, ignoring validity.
     * @param validity validity of information in seconds.
     */
    public async updateOwnerAndPermissions(force: boolean = false, validity: number = 60) {
        // Update owner and permissions, if they weren't updated recently.
        // TODO: the rate limiting here is a bit wonky - it breaks when there was an error fetching the owner.
        // Maybe reset last_owner_and_permission_update on failiure?
        if(force || (Date.now() - (validity * 1000)) > this.last_owner_and_permission_update) {
            const prev_update = this.last_owner_and_permission_update;
            Logging.InfoDev("Updating owner and permissions for place " + this.placeId);
            try {
                this.last_owner_and_permission_update = Date.now();
                this.owner = await Contracts.getPlaceOwner(this.placeId);
                this.permissions = await Contracts.getPlacePermissions(this.world.walletProvider, this.placeId, this.owner);
            }
            catch(reason: any) {
                this.last_owner_and_permission_update = prev_update;
                Logging.InfoDev("failed to load permissions/ownership " + this.placeId);
                Logging.InfoDev(reason);
            }
        }
    }
}