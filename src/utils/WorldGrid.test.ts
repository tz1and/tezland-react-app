import { Vector3 } from '@babylonjs/core';
import WorldGrid from './WorldGrid';

test('grid calc', () => {
    const gridSize = 100.0;

    const testPos = (pos: Vector3, expectedCell: Vector3, expectedHash: string) => {
        const gridCell = WorldGrid.getGridCell(pos.x, pos.y, pos.z, gridSize);
        expect(gridCell).toStrictEqual(expectedCell);

        expect(WorldGrid.toCellHash(gridCell)).toStrictEqual(expectedHash);
    }

    testPos(new Vector3(0,0,0), new Vector3(1, 1, 1), "861426eb6d3bfe5e19bfad60452c467b8a521d58");
    testPos(new Vector3(0,-0.1,0), new Vector3(1, -1, 1), "cd04cf6e1efb41ed59fc201220e550b0dc538b91");
    testPos(new Vector3(50,0,50), new Vector3(1, 1, 1), "861426eb6d3bfe5e19bfad60452c467b8a521d58");
    testPos(new Vector3(100,0,50), new Vector3(2, 1, 1), "e3ec6b8b6d29f080f002bf0306e60081551e6a86");
    testPos(new Vector3(-100,0,50), new Vector3(-2, 1, 1), "d7eb4d99a88c8c194a224d01267ac8405db2b063");
    testPos(new Vector3(-100000000000,0,150), new Vector3(-1000000001, 1, 2), "56e0d9c551b8f947348d3346bbd22dbdce84a121");
    testPos(new Vector3(-100000000000,0,15000000000000), new Vector3(-1000000001, 1, 150000000001), "7f6bf9f2929f3c2bf8903fa6aa470bbd94cbbbcc");
    testPos(new Vector3(200000000000,499999999999.9999,-15000000000000), new Vector3(2000000001, 5000000000, -150000000001), "309455096ed58d5fad02f063048d9a87c823625c");
});