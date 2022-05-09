import { Vector3 } from '@babylonjs/core';
import { createHash } from 'crypto';
import { fetchGraphQL } from '../ipfs/graphql';
import AppSettings from '../storage/AppSettings';
import Metadata from '../world/Metadata';
import { Logging } from './Logging';

export type WorldGridCell = {
    places: number[];
    worldPlaceCount: number;
}

//export type WorldGridMap = Map<string, WorldGridCell>;

export default class WorldGrid {
    private static dbName = "worldGrid";
    private static gridSize = 100.0;

    public async getPlacesForPosition(x: number, y: number, z: number, worldPlaceCount: number) {
        //const range = Math.ceil(AppSettings.drawDistance.value / WorldGrid.gridSize) * WorldGrid.gridSize;
        const range = AppSettings.drawDistance.value;
        
        const grid_min = WorldGrid.getGridCell(x - range, y, z - range, WorldGrid.gridSize);
        const grid_max = WorldGrid.getGridCell(x + range, y, z + range, WorldGrid.gridSize);

        const cells: Promise<WorldGridCell>[] = [];
        const tempVec = new Vector3();

        for (let z = grid_min.z; z <= grid_max.z; ++z)
            for (let x = grid_min.x; x <= grid_max.x; ++x) {
                // there is no 0 cell, on any axis.
                if (x === 0 || z === 0) continue;

                tempVec.set(x, 1, z);
                const gridHash = WorldGrid.toCellHash(tempVec);

                cells.push(new Promise((resolve) => {
                    Metadata.Storage.loadObject(gridHash, WorldGrid.dbName).then((cell) => {
                        // Fetch cell if updated or doesn't exist.
                        if (!cell || cell.worldPlaceCount !== worldPlaceCount) {
                            Logging.InfoDev("fetching cell", gridHash, cell ? cell.worldPlaceCount : "unknown cell");
                            fetchGraphQL(`
                                query getWorldGridCell($gridHash: String) {
                                    place_token_metadata(where: { grid_hash: { _eq: $gridHash } }) {
                                        token_id
                                    }
                                }`, "getWorldGridCell", { gridHash: gridHash }).then((data) => {
                                    const places_in_cell: number[] = [];
                                    for (const placeToken of data.place_token_metadata)
                                        places_in_cell.push(placeToken.token_id);

                                    cell = { places: places_in_cell, worldPlaceCount: worldPlaceCount };

                                    Metadata.Storage.saveObject(gridHash, WorldGrid.dbName, cell);

                                    resolve(cell);
                                });
                        }
                        else resolve(cell);
                    });
                }));
            }

        return Promise.all(cells);
    }

    private static toGrid(coordinate: number, gridSize: number): number {
        const sign = (coordinate < 0) ? -1 : 1;
        return Math.trunc(coordinate/gridSize) + sign;
    }
    
    public static getGridCell(x: number, y: number, z: number, gridSize: number = 100.0): Vector3 {
        return new Vector3(this.toGrid(x, gridSize), this.toGrid(y, gridSize), this.toGrid(z, gridSize));
    }

    public static toCellHash(cell: Vector3): string {
        const cell_string = `${cell.x}-${cell.y}-${cell.z}`;
        return createHash('sha1').update(cell_string).digest('hex');
    }
}
