import React, { createRef } from "react";
import { Svg } from "@svgdotjs/svg.js";
import { Angle, Vector2 } from '@babylonjs/core'
import Conf from "../Config";
import { OpKind } from "@taquito/taquito";
import { char2Bytes } from '@taquito/utils'
import { createPlaceTokenMetadata, upload_places } from "../ipfs/ipfs";
import { sleep } from "../utils/Utils";
import TezosWalletContext from "../components/TezosWalletContext";
import WorldGen, { Bridge, WorldDefinition } from "../worldgen/WorldGen";
import VoronoiDistrict from "../worldgen/VoronoiDistrict";
import assert from "assert";

type GenerateMapState = {
    svg?: string;
    world_def?: WorldDefinition;
    worldgen?: WorldGen;
}

type GenerateMapProps = {

}

export default class GenerateMap extends React.Component<GenerateMapProps, GenerateMapState> {
    static override contextType = TezosWalletContext;
    override context!: React.ContextType<typeof TezosWalletContext>;
    
    constructor(props: GenerateMapProps) {
        super(props);
        this.state = {

        };
    }

    private svgRef = createRef<SVGSVGElement>();

    private downloadSvgFile = () => {
        if(!this.state.svg) return;

        // create blob from data
        const data = new Blob([this.state.svg], { type: 'image/svg+xml' });
        const downloadLink = window.URL.createObjectURL(data);

        // create download file link
        const link = document.createElement('a');
        link.href = downloadLink;
        link.setAttribute(
            'download',
            `map.svg`,
        );

        // Append to html link element and cick it
        document.body.appendChild(link);
        link.click();

        // Clean up and remove the link
        document.body.removeChild(link);
    }

    private downloadDistrictsFile = () => {
        if(!this.state.svg) return;

        // create blob from data
        const data = new Blob([JSON.stringify(this.state.world_def)], { type: 'application/json' });
        const downloadLink = window.URL.createObjectURL(data);

        // create download file link
        const link = document.createElement('a');
        link.href = downloadLink;
        link.setAttribute(
            'download',
            `districts.json`,
        );

        // Append to html link element and cick it
        document.body.appendChild(link);
        link.click();

        // Clean up and remove the link
        document.body.removeChild(link);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private mintPlaces = async () => {
        assert(this.state.worldgen);

        const worldgen = this.state.worldgen;

        const minterWallet = await this.context.tezosToolkit().wallet.at(Conf.minter_contract);
        const walletphk = this.context.walletPHK();

        const places = []

        for (const district of worldgen.districts)
            for (const block of district.blocks)
                for (const lot of block.lots) {
                    if(lot.isValid()) {
                        const centroid = lot.centroid();
                        const pointsrel: number[][] = [];
                        lot.verticesRelative(centroid).forEach((p) => {
                            pointsrel.push([p.x, 0, p.y])
                        });

                        places.push(createPlaceTokenMetadata({
                            name: `Place #${places.length}`,
                            description: `${lot.area().toFixed(2)} \u33A1`,
                            minter: walletphk,
                            centerCoordinates: [centroid.x + district.center.x, 0, centroid.y + district.center.y],
                            borderCoordinates: pointsrel,
                            buildHeight: 10,
                            placeType: "exterior"
                        }));
                    }
                }

        console.log("valid places", places.length);

        // Upload all places metadata
        // eslint-disable-next-line no-unreachable
        const place_meta_files = await upload_places(places);

        console.log("upload places done");

        // Mint places
        let batch = this.context.tezosToolkit().wallet.batch();
        let batch_size = 0;

        for(const meta of place_meta_files) {
            console.log(meta);

            batch.with([
                {
                    kind: OpKind.TRANSACTION,
                    ...minterWallet.methodsObject.mint_Place({
                        address: walletphk,
                        metadata: char2Bytes(meta)
                    }).toTransferParams()
                }
            ]);

            batch_size++;

            if(batch_size >= 150) {
                console.log("batch limit reached, sending batch");

                const batch_op = await batch.send();
                await batch_op.confirmation();

                // TODO: figure out how long to wait between operations...
                console.log("sleep a little");
                await sleep(10000);
                console.log("done sleeping, preparing next batch");

                batch = this.context.tezosToolkit().wallet.batch();
                batch_size = 0;
            }
        }

        if(batch_size > 0) {
            const batch_op = await batch.send();
            await batch_op.confirmation();
        }
    }

    private generateDistrict1() {
        const district_1 = new VoronoiDistrict(new Vector2(0,0), [
            new Vector2(-100,-100),
            new Vector2(-100,100),
            new Vector2(200,200),
            new Vector2(100,-100)
        ]);

        // generate central circle
        district_1.addCircle(new Vector2(0, 0), 40, 0, 8);

        for(const s of district_1.sites) {
            district_1.noSplit.push(new Vector2(s.x, s.y));
        }

        district_1.addCircle(new Vector2(0, 0), 80, 0, 8);

        // generate grid blocks
        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(395 - 65 * i, 275), 65, Angle.FromDegrees(45).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(395 - 65, 275));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(395 - 65 * i, 405), 65, Angle.FromDegrees(45).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(395 - 65, 405));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(-395 + 65 * i, 275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(-395 + 65, 275));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(-395 + 65 * i, 405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(-395 + 65, 405));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(395 - 65 * i, -275), 65, Angle.FromDegrees(0).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(395 - 65, -275));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(395 - 65 * i, -405), 65, Angle.FromDegrees(0).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(395 - 65, -405));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(-395 + 65 * i, -275), 65, Angle.FromDegrees(45).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(-395 + 65, -275));

        for (let i = 0; i < 4; ++i) {
            district_1.addCircle(new Vector2(-395 + 65 * i, -405), 65, Angle.FromDegrees(45).radians(), 4);
        }

        district_1.noSplit.push(new Vector2(-395 + 65, -405));

        // generate other circles
        district_1.addCircle(new Vector2(0, 275 + 65), 80, 0, 5);
        district_1.addCircle(new Vector2(0, -275 - 65), 80, Angle.FromDegrees(180).radians(), 5);

        district_1.noSplit.push(new Vector2(0, 275 + 65));
        district_1.noSplit.push(new Vector2(0, -275 - 65));

        district_1.addCircle(new Vector2(-275 - 65, 0), 90, 0, 6);
        district_1.addCircle(new Vector2(275 + 65, 0), 90, Angle.FromDegrees(90).radians(), 6);

        district_1.noSplit.push(new Vector2(275 + 65, 0));
        district_1.noSplit.push(new Vector2(-275 - 65, 0));

        district_1.addRandomSites(200, 663);

        return district_1;
    }

    // Similar to componentDidMount and componentDidUpdate:
    override componentDidMount() {
        const dim = 1000;

        const worldgen = new WorldGen();

        // First district
        const district_1 = this.generateDistrict1();
        worldgen.addDistrict(district_1);

        // Second district
        const district_2 = this.generateDistrict1();
        district_2.center = new Vector2(50, 300);
        district_2.vertices = [
            new Vector2(-200,-200),
            new Vector2(-100,100),
            new Vector2(100,100),
            new Vector2(100,-100)
        ]
        worldgen.addDistrict(district_2);

        //Bridging districts on (1 3) at distance  15.811388300841896

        //worldgen.addBridge({})
        //worldgen.addConnection(district_1, district_2);
        worldgen.addBridge(new Bridge(district_1, 1, 0.05, district_2, 3, 0.8));
        worldgen.addBridge(new Bridge(district_1, 1, 0.25, district_2, 3, 0.6));
        worldgen.addBridge(new Bridge(district_1, 1, 0.5, district_2, 3, 0.35));
        worldgen.addBridge(new Bridge(district_1, 1, 0.75, district_2, 3, 0.1));

        worldgen.generateWorld();

        /*const mainRoads: DeepEqualsSet<Edge> = new DeepEqualsSet();

        let land_limit_counter = 0;
        const land_limit = Infinity;
        for(const land of landArray) {
            land.edges().forEach(mainRoads.add, mainRoads);
        }
        console.log("mainRoads", mainRoads.size);

        const mainRoadCurbs: DeepEqualsSet<Edge> = new DeepEqualsSet();

        land_limit_counter = 0;
        for(const land of landArray) {
            land.edges().forEach(mainRoadCurbs.add, mainRoadCurbs);
        }*/

        // create canvas
        // Mirror map on x, to make it match the babylon coordinate system.
        // TODO: create canvas based on world extent.
        const draw = new Svg(this.svgRef.current!).size(dim, dim).viewbox(-dim/2, -dim/2, dim, dim).scale(-1,1);
        draw.clear();

        // Colors
        const lotFillColor = '#d6f0ff';
        const lotStrokeColor = '#3d8dba';
        const blockFillColor = '#eaeaea';
        const blockStrokeColor = '#777777'; // eslint-disable-line @typescript-eslint/no-unused-vars
        const districtFillColor = '#f6f6f6';
        const districtStrokeColor = '#888888';
        const bridgeColor = '#888888';

        // Draw the svg
        // TODO: figure out which way to flip the map...
        // TODO: lots should be realtive to blocks, blocks relative to districts.
        for (const district of worldgen.districts) {
            draw.polygon(district.verticesToArray(district.center)).fill(districtFillColor).stroke(districtStrokeColor).attr({'stroke-width': 0.5});

            for (const block of district.blocks) {
                draw.polygon(block.verticesToArray(district.center)).fill(blockFillColor)/*.stroke(blockStrokeColor)*/.attr({'stroke-width': 0.5});

                for (const lot of block.lots) {
                    if(lot.isValid()) {
                        draw.polygon(lot.verticesToArray(district.center)).fill(lotFillColor).stroke(lotStrokeColor).attr({'stroke-width': 0.5});
                        const centroid = lot.centroid(district.center);
                        draw.circle(1).fill(lotFillColor).stroke(lotStrokeColor).move(centroid.x - 0.5, centroid.y - 0.5);
                        //draw.circle(1).stroke('blue').fill('blue').move(land.center.x - 0.5, land.center.y - 0.5);
                    }
                }
            }
        }

        for (const bridge of worldgen.bridges) {
            draw.line(bridge.bridge_path[0].asArray().concat(bridge.bridge_path[1].asArray())).stroke(bridgeColor).attr({'stroke-width': 10});
        }

        // Draw roads
        /*for (const road of mainRoads) {
            draw.line(road.pointsToArray()).fill('red').stroke('red').attr({'stroke-width': 0.5});
        }

        for (const curb of mainRoadCurbs) {
            draw.line(curb.pointsToArray()).fill('green').stroke('green').attr({'stroke-width': 0.5});
        }*/

        this.setState({ worldgen: worldgen, svg: draw.svg(), world_def: worldgen.serialise() });
    }

    override render(): React.ReactNode {
        return (
            <main className="container">
                <button className="btn btn-primary me-2" onClick={() => this.mintPlaces()}>Mint</button>
                <button className="btn btn-primary me-2" onClick={() => this.downloadSvgFile()}>Download SVG</button>
                <button className="btn btn-primary me-2" onClick={() => this.downloadDistrictsFile()}>Download Districts</button>
                <svg className="d-block" ref={this.svgRef}></svg>
            </main>
        );
    }
};