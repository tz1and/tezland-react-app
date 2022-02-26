import District from "./District";
import Block from "./Block";
import Lot from "./Lot";


/**
 * The world is made up of Districts (there can be different kinds, initially VoronoiDistrict).
 * Districts subdivide into Blocks and Blocks into Lots.
 * 
 * Everything that is not "Land" is water. Spaces between Districts are rivers, lakes, etc.
 */

export default class WorldGen {
    public districts: District[];

    constructor() {
        this.districts = [];
    }

    public addDistrict(district: District) {
        this.districts.push(district);
    }

    public generateWorld() {
        this.districts.forEach((d) => {
            d.generateBlocks();
        })
    }
}