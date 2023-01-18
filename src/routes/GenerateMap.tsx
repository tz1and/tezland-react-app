import React, { createRef } from "react";
import { Svg } from "@svgdotjs/svg.js";
import { Angle, Vector2 } from '@babylonjs/core'
import Conf from "../Config";
import { MichelsonMap, OpKind, WalletParamsWithKind } from "@taquito/taquito";
import { char2Bytes } from '@taquito/utils'
import { createPlaceTokenMetadata, upload_places } from "../ipfs/ipfs";
import { downloadFile, signedArea, sleep } from "../utils/Utils";
import { mutezToTez, tezToMutez } from "../utils/TezosUtils";
import TezosWalletContext from "../components/TezosWalletContext";
import WorldGen, { Bridge, WorldDefinition } from "../worldgen/WorldGen";
import VoronoiDistrict, { ExclusionZone } from "../worldgen/VoronoiDistrict";
import { PublicPlaces } from "../worldgen/PublicPlaces";
import assert from "assert";
import Contracts from "../tz/Contracts";
import Metadata from "../world/Metadata";
import BigNumber from "bignumber.js";
import Lot from "../worldgen/Lot";
import Prando from "prando";
import PlaceKey from "../utils/PlaceKey";
import { PlacePermissions } from "../world/nodes/BasePlaceNode";

const prodAdminAddress = "tz1Ly2nrAF7p4dYGHYfuDNTX6M3Ly8tDZ7Pn";

type GenerateMapState = {
    svg?: string;
    world_def?: WorldDefinition;
    worldgen?: WorldGen;
}

type GenerateMapProps = {

}

export default class GenerateMap extends React.Component<GenerateMapProps, GenerateMapState> {
    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;
    
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

        downloadFile(downloadLink, "map.svg");
    }

    private downloadDistrictsFile = () => {
        if(!this.state.svg) return;

        // create blob from data
        const data = new Blob([JSON.stringify(this.state.world_def)], { type: 'application/json' });
        const downloadLink = window.URL.createObjectURL(data);

        downloadFile(downloadLink, "districts.json");
    }

    private squareLot = (width: number, height: number, buildHeight: number): [Lot, number[], number[][]] => {
        const w_half = width / 2, h_half = height / 2;

        const lot = new Lot(new Vector2(0, 0), [
            new Vector2(w_half, h_half),
            new Vector2(w_half, -h_half),
            new Vector2(-w_half, -h_half),
            new Vector2(-w_half, h_half),
        ]);
        lot.buildHeight = buildHeight

        const centroid = lot.centroid();
        const pointsrel: number[][] = [];
        lot.verticesRelative(centroid).forEach((p) => {
            pointsrel.push([parseFloat(p.x.toFixed(4)), 0, parseFloat(p.y.toFixed(4))])
        });

        const centercoords: number[] = [parseFloat((centroid.x).toFixed(4)), 0, parseFloat((centroid.y).toFixed(4))];

        return [lot, centercoords, pointsrel];
    }

    private mintSpecialInteriors = async () => {
        const interiorPlaces = await this.context.tezosToolkit().wallet.at(Conf.interior_contract);
        const walletphk = this.context.walletPHK();
        assert(walletphk === prodAdminAddress, "Not admin!");

        const next_minted_place_id = (await Contracts.countInteriorPlacesView(this.context)).toNumber();

        const place_params = [
            // EXAMPLE
            {width: 160, height: 160, build_height: 160, to: prodAdminAddress}, // Interior #0, Admin
        ]

        const places = []

        for (const [idx, params] of place_params.entries()) {
            const lot_id = next_minted_place_id + idx;

            console.log("interior id", lot_id)

            const [lot, centercoords, pointsrel] = this.squareLot(params.width, params.height, params.build_height);

            places.push(createPlaceTokenMetadata({
                name: `tz1and Interior #${lot_id}`,
                description: `${lot.area().toFixed(2)} \u33A1`,
                minter: walletphk,
                centerCoordinates: centercoords,
                borderCoordinates: pointsrel,
                buildHeight: parseFloat(lot.buildHeight.toFixed(4)),
                placeType: "interior",
                royalties: {
                    decimals: 3,
                    shares: new Map([
                        [Conf.fees_address, 100]
                    ])
                }
            }));

            console.log("place area and dims", lot.area(), [params.width, params.height, lot.buildHeight]);
        }

        // Upload all places metadata
        // eslint-disable-next-line no-unreachable
        const place_meta_files = await upload_places(places);

        console.log("upload places done");

        let batch = [];

        for(let idx = 0; idx < place_params.length; ++idx) {
            const params = place_params[idx];
            const meta = place_meta_files[idx];
            console.log(meta, params.to);

            const metadata_map = new MichelsonMap<string,string>({ prim: "map", args: [{prim: "string"}, {prim: "bytes"}]});
            metadata_map.set('', char2Bytes(meta));
            batch.push({
                to_: params.to,
                metadata: metadata_map
            });
        }

        console.log(`minting ${place_params.length} new places`);

        const batch_op = await interiorPlaces.methodsObject.mint(batch).send();

        await new Promise<void>((resolve, reject) => {
            Contracts.handleOperation(this.context, batch_op, (completed) => {
                if (completed) resolve();
                else reject();
            }, 3);
        })
    }

    private mintInteriors = async () => {
        const interiorPlaces = await this.context.tezosToolkit().wallet.at(Conf.interior_contract);
        const walletphk = this.context.walletPHK();
        assert(walletphk === prodAdminAddress, "Not admin!");

        const next_minted_place_id = (await Contracts.countInteriorPlacesView(this.context)).toNumber();

        const num_places = 50, min_size = 30, max_size = 60;

        const prando = new Prando(next_minted_place_id);

        let total_price = new BigNumber(0);
        const places = []

        for (let i = 0; i < num_places; ++i) {
            const lot_id = next_minted_place_id + i;

            console.log("interior id", lot_id)

            const w = prando.next(min_size, max_size), h = prando.next(min_size, max_size);
            const min_dim = Math.min(w, h);
            const build_height = prando.next(min_dim / 2, min_dim);

            const [lot, centercoords, pointsrel] = this.squareLot(w, h, build_height);

            places.push(createPlaceTokenMetadata({
                name: `tz1and Interior #${lot_id}`,
                description: `${lot.area().toFixed(2)} \u33A1`,
                minter: walletphk,
                centerCoordinates: centercoords,
                borderCoordinates: pointsrel,
                buildHeight: parseFloat(lot.buildHeight.toFixed(4)),
                placeType: "interior",
                royalties: {
                    decimals: 3,
                    shares: new Map([
                        [Conf.fees_address, 100]
                    ])
                }
            }));

            const priceMult = 3;
            const pricePerAreaFactor = 1 / (40 / priceMult);
            const pricePerVolumeFactor = 1 / (1000 / priceMult);

            const areaPoly: number[] = [];
            for(const pos of pointsrel) areaPoly.push(pos[0], pos[2]);

            const placeArea = Math.abs(signedArea(areaPoly, 0, areaPoly.length, 2));
            const placePrice = tezToMutez(parseFloat((
                10 * priceMult
                + placeArea * pricePerAreaFactor
                + placeArea * lot.buildHeight * pricePerVolumeFactor
            ).toFixed(1)));

            console.log("place pice", mutezToTez(placePrice).toNumber());
            console.log("place area and dims", placeArea, [w, h, lot.buildHeight]);

            total_price = total_price.plus(placePrice);
        }

        console.log("total price", mutezToTez(total_price).toNumber());

        // Upload all places metadata
        // eslint-disable-next-line no-unreachable
        const place_meta_files = await upload_places(places);

        console.log("upload places done");

        let batch = [];

        for(const meta of place_meta_files) {
            console.log(meta);

            const metadata_map = new MichelsonMap<string,string>({ prim: "map", args: [{prim: "string"}, {prim: "bytes"}]});
            metadata_map.set('', char2Bytes(meta));
            batch.push({
                to_: walletphk,
                metadata: metadata_map
            });
        }

        console.log(`minting ${num_places} new places`);

        const batch_op = await interiorPlaces.methodsObject.mint(batch).send();

        await new Promise<void>((resolve, reject) => {
            Contracts.handleOperation(this.context, batch_op, (completed) => {
                if (completed) resolve();
                else reject();
            }, 3);
        })
    }

    private mintPlaces = async () => {
        assert(this.state.worldgen);

        const worldgen = this.state.worldgen;

        const minterWallet = await this.context.tezosToolkit().wallet.at(Conf.minter_contract);
        const walletphk = this.context.walletPHK();
        assert(walletphk === prodAdminAddress, "Not admin!");

        const last_minted_place_id = (await Contracts.countExteriorPlacesView(this.context)).minus(1).toNumber();

        const places = []

        let lot_counter = 0;
        for (const district of worldgen.districts)
            for (const block of district.blocks)
                for (const lot of block.lots) {
                    if(lot.isValid()) {
                        if (lot_counter > last_minted_place_id) {
                            const centroid = lot.centroid();
                            const pointsrel: number[][] = [];
                            lot.verticesRelative(centroid).forEach((p) => {
                                pointsrel.push([parseFloat(p.x.toFixed(4)), 0, parseFloat(p.y.toFixed(4))])
                            });

                            const centercoords: number[] = [parseFloat((centroid.x + district.center.x).toFixed(4)), 0, parseFloat((centroid.y + district.center.y).toFixed(4))];

                            places.push(createPlaceTokenMetadata({
                                name: `tz1and Place #${lot_counter}`,
                                description: `${lot.area().toFixed(2)} \u33A1`,
                                minter: walletphk,
                                centerCoordinates: centercoords,
                                borderCoordinates: pointsrel,
                                buildHeight: parseFloat(lot.buildHeight.toFixed(4)),
                                placeType: "exterior",
                                royalties: {
                                    decimals: 3,
                                    shares: new Map([
                                        [Conf.fees_address, 100]
                                    ])
                                }
                            }));
                        }

                        ++lot_counter;
                    }
                }

        console.log("valid places", places.length);
        console.log("frst new place", places[0]);
        console.log("last new place", places[places.length - 1]);

        // Upload all places metadata
        // eslint-disable-next-line no-unreachable
        const place_meta_files = await upload_places(places);

        console.log("upload places done");

        // Mint places
        let batch = [];

        for(const meta of place_meta_files) {
            console.log(meta);

            const metadata_map = new MichelsonMap<string,string>({ prim: "map", args: [{prim: "string"}, {prim: "bytes"}]});
            metadata_map.set('', char2Bytes(meta));
            batch.push({
                to_: walletphk,
                metadata: metadata_map
            });

            if(batch.length >= 120) {
                console.log("batch limit reached, sending batch");

                const batch_op = await minterWallet.methodsObject.mint_Place(batch).send();

                await new Promise<void>((resolve, reject) => {
                    Contracts.handleOperation(this.context, batch_op, (completed) => {
                        if (completed) resolve();
                        else reject();
                    }, 3);
                })

                // TODO: wait for finality!

                // TODO: figure out how long to wait between operations...
                console.log("sleep a little");
                await sleep(10000);
                console.log("done sleeping, preparing next batch");

                batch.length = 0;
            }
        }

        if(batch.length > 0) {
            const batch_op = await minterWallet.methodsObject.mint_Place(batch).send();

            await new Promise<void>((resolve, reject) => {
                Contracts.handleOperation(this.context, batch_op, (completed) => {
                    if (completed) resolve();
                    else reject();
                }, 3);
            })

            // TODO: wait for finality!
        }
    }

    private createAuctions = async () => {
        const walletphk = this.context.walletPHK();
        assert(walletphk === prodAdminAddress, "Not admin!");

        // TODO: add batch support!

        const interiors: boolean = true;
        const auction_id_list: number[] = [];

        if (interiors) {
            const last_batch_id = 3;
            const next_minted_place_id = (await Contracts.countInteriorPlacesView(this.context)).toNumber();

            for (let id = (last_batch_id + 1); id < next_minted_place_id; ++id) {
                auction_id_list.push(id);
            }
        }
        else {
            // TODO: fix this mess
            const last_batch_id = 673 + 1;
            const last_minted_place_id = (await Contracts.countExteriorPlacesView(this.context)).minus(1).toNumber();

            const known_places: number[] = Array.from({length: last_minted_place_id - last_batch_id + 1}, (x, i) => last_batch_id + i);
            const exclude_places: Set<number> = new Set([
            ]);

            for (const place_id of known_places) {
                if (!PublicPlaces.has(place_id) && !exclude_places.has(place_id))
                    auction_id_list.push(place_id);
            }
        }

        console.log(auction_id_list.length);
        console.log(auction_id_list);

        assert(auction_id_list.length > 0);
        assert(auction_id_list.length <= 100);

        const auctionsWallet = await this.context.tezosToolkit().wallet.at(Conf.dutch_auction_contract);
        const placesWallet = await this.context.tezosToolkit().wallet.at(interiors ? Conf.interior_contract : Conf.place_contract);

        const duration = 168; // 7 days = 24h * 7.
        const start_time_offset = 45; // in seconds, should be larger than current block time (30s).
        const current_time = Math.floor(Date.now() / 1000);
        const start_time = (Math.floor((current_time + start_time_offset) / 60) + 1) * 60; // begins at the next full minute.
        const end_time = Math.floor(start_time + duration * 3600); // hours to seconds

        const priceMult = 3;
        const pricePerAreaFactor = 1 / (40 / priceMult);
        const pricePerVolumeFactor = 1 / (1000 / priceMult);

        const operator_adds = [];
        const create_ops: WalletParamsWithKind[] = [];

        let running_total = new BigNumber(0);

        for (const place_id of auction_id_list) {
            const place_metadata = await Metadata.getPlaceMetadata(place_id, placesWallet.address);
            assert(place_metadata);

            const polygon = place_metadata.borderCoordinates;
            const areaPoly: number[] = [];
            for(const pos of polygon) areaPoly.push(pos[0], pos[2]);

            const placeArea = Math.abs(signedArea(areaPoly, 0, areaPoly.length, 2));
            const placePrice = tezToMutez(parseFloat((
                10 * priceMult
                + placeArea * pricePerAreaFactor
                + placeArea * place_metadata.buildHeight * pricePerVolumeFactor
            ).toFixed(1)));

            running_total = running_total.plus(placePrice);

            console.log(placeArea, mutezToTez(placePrice).toNumber());

            create_ops.push({
                kind: OpKind.TRANSACTION,
                ...auctionsWallet.methodsObject.create({
                    auction_key: {
                        fa2: placesWallet.address,
                        token_id: place_id,
                        owner: walletphk
                    },
                    auction: {
                        start_price: placePrice,
                        end_price: placePrice,
                        start_time: start_time.toString(),
                        end_time: end_time.toString()
                    }
                }).toTransferParams()
            });

            operator_adds.push({
                add_operator: {
                    owner: walletphk,
                    operator: auctionsWallet.address,
                    token_id: place_id
                }
            });
        }

        console.log("total value: ", mutezToTez(running_total).toNumber());

        const batch_op = await this.context.tezosToolkit().wallet.batch([
            {
                kind: OpKind.TRANSACTION,
                ...placesWallet.methodsObject.update_operators(operator_adds).toTransferParams()
            },
            ...create_ops
        ]).send();

        Contracts.handleOperation(this.context, batch_op, undefined, 3);
    }

    private batchWhitelist = async () => {
        const walletphk = this.context.walletPHK();
        assert(walletphk === prodAdminAddress, "Not admin!");

        const auctionsWallet = await this.context.tezosToolkit().wallet.at(Conf.dutch_auction_contract);

        const wl_op = await auctionsWallet.methodsObject.manage_whitelist([
            {
                whitelist_add: [

                ]
            }
        ]).send();

        Contracts.handleOperation(this.context, wl_op, undefined, 3);
    }

    private batchPermissions = async () => {
        const walletphk = this.context.walletPHK();
        assert(walletphk === prodAdminAddress, "Not admin!");

        const worldWallet = await this.context.tezosToolkit().wallet.at(Conf.world_contract);

        type PermissionEntry = { permittee: string; token_id: number };
        const give_permissions: PermissionEntry[] = [
            //{permittee: "address", token_id: 10}
        ];

        const remove_permissions: PermissionEntry[] = [
            //{permittee: "address", token_id: 10}
        ];

        const ops = []
        for (const perm of give_permissions) {
            ops.push(
                {
                    add: {
                        owner: walletphk,
                        permittee: perm.permittee,
                        place_key: new PlaceKey(perm.token_id, Conf.place_contract),
                        perm: PlacePermissions.permissionPlaceItems
                    }
                }
            );
        }

        for (const perm of remove_permissions) {
            ops.push(
                {
                    remove: {
                        owner: walletphk,
                        permittee: perm.permittee,
                        place_key: new PlaceKey(perm.token_id, Conf.place_contract),
                    }
                }
            );
        }

        const set_permissions_op = await worldWallet.methodsObject.set_permissions(ops).send();

        Contracts.handleOperation(this.context, set_permissions_op, undefined, 3);
    }

    private batchTransferPlaces = async () => {
        const placesWallet = await this.context.tezosToolkit().wallet.at(Conf.place_contract);

        const to = "tz1Ly2nrAF7p4dYGHYfuDNTX6M3Ly8tDZ7Pn";
        const place_ids: string[] = [];
        const txs = [];
        for (const id of place_ids) {
            txs.push({
                to_: to,
                amount: 1,
                token_id: id
            })
        }

        const transfer_places_op = await placesWallet.methodsObject.transfer([{
            from_: this.context.walletPHK(),
            txs: txs
        }]).send();

        Contracts.handleOperation(this.context, transfer_places_op, undefined, 3);
    }

    // The wing
    private generateDistrict1() {
        const district = new VoronoiDistrict(new Vector2(0,0), [
            // right edge
            new Vector2(-0,-200),
            new Vector2(-44,-90),
            new Vector2(-15,-25),
            new Vector2(-27,-7),
            new Vector2(-27,7),
            new Vector2(-15,25),
            new Vector2(-44,90),
            new Vector2(0,200),
            // bottom
            new Vector2(200,200),
            // left
            new Vector2(200,130),
            new Vector2(150,40),
            new Vector2(150,-40),
            new Vector2(200,-130),
            new Vector2(200,-200),
            /*new Vector2(500,-500),
            new Vector2(500,500),
            new Vector2(-500,500),
            new Vector2(-500,-500),*/
        ], 1234);

        // generate central circle
        district.addCircle(new Vector2(0, 0), 40, 0, 8);

        for(const s of district.sites) {
            district.noSplit.push(new Vector2(s.x, s.y));
        }

        district.addCircle(new Vector2(0, 0), 80, 0, 8);

        // Add some square blocks
        for (let i = 0; i < 1; ++i) {
            district.addCircle(new Vector2(164 - 65 * i, -164), 65, Angle.FromDegrees(0).radians(), 4);
        }

        for (let i = 0; i < 1; ++i) {
            district.addCircle(new Vector2(164 - 65 * i, 164), 65, Angle.FromDegrees(0).radians(), 4);
        }

        //district_1.noSplit.push(new Vector2(395 - 65, -200));

        // generate grid blocks
        /*for (let i = 0; i < 4; ++i) {
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
        district_1.noSplit.push(new Vector2(-275 - 65, 0));*/

        district.addRandomSites(20, 10);

        district.teleportation_booths.push(new Vector2(20, -11));
        district.teleportation_booths.push(new Vector2(130, -195));
        district.teleportation_booths.push(new Vector2(50, 195));

        return district;
    }

    // It's the little island
    private generateDistrict2() {

        const pointOnCircle = (r: number, t: number, p: Vector2 = Vector2.Zero()) => {
            return new Vector2(r * Math.cos(t) + p.x, r * Math.sin(t) + p.y)
        }

        const points = [];
        for (let angle = 0; angle < 2 * Math.PI; angle += 2 * Math.PI / 7) {
            points.push(pointOnCircle(40, angle).negate());
        }

        //const r1 = 29, r2 = 40;
        const district = new VoronoiDistrict(new Vector2(0,0),
            points.reverse(),
            /*[
                new Vector2(-r1,-r1),
                new Vector2(-r2,-0), //c
                new Vector2(-r1,r1),
                new Vector2(0,r2), //c
                new Vector2(r1,r1),
                new Vector2(r2,10), //c
                new Vector2(r2,-10), //c
                new Vector2(r1,-r1),
                new Vector2(0,-r2),
            ],*/ 1337
        );

        // generate central circle
        district.addCircle(new Vector2(0, 0), 100, 0, 8);

        for(const s of district.sites) {
            district.noSplit.push(new Vector2(s.x, s.y));
        }

        district.center = new Vector2(-100, 0);

        return district
    }

    // The reverse C
    private generateDistrict3() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                // right edge
                new Vector2(180,-200),
                new Vector2(120,-80),
                new Vector2(50,-70),
                new Vector2(10,0),
                new Vector2(50,70),
                new Vector2(120,80),
                new Vector2(180,200),
                new Vector2(-30,200),
                new Vector2(-100,130),
                new Vector2(-100,-130),
                new Vector2(-30,-200),
            ].reverse(), 255
        );

        district.spawn = new Vector2(-7.8, 0);

        // generate central circle
        district.addCircle(new Vector2(45, -80), 50, 0, 6);
        district.noSplit.push(new Vector2(45, -80));

        district.addCircle(new Vector2(45, 80), 50, 0, 6);
        district.noSplit.push(new Vector2(45, 80));

        // generate a block
        district.addCircle(new Vector2(-62.2, 0), 70, Angle.FromDegrees(0).radians(), 4);

        //district_3.addSite(new Vector2(7.8, 0), false, true, 25);
        district.noSplit.push(new Vector2(7.8, 0));
        district.noSplit.push(new Vector2(20, -36.69872981077806));
        district.noSplit.push(new Vector2(20, 36.69872981077806));

        district.addRandomSites(5, 15589);

        district.center = new Vector2(-200, 0);

        district.teleportation_booths.push(new Vector2(-30, 0));
        district.teleportation_booths.push(new Vector2(45, 145));
        district.teleportation_booths.push(new Vector2(85, -155));

        return district;
    }

    // The the lower right part of the ring
    private generateDistrict4() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(250,-80), // top left
                new Vector2(260,100), // bottom left
                new Vector2(80,100), // bay bottom
                new Vector2(80,60), // bay bottom
                new Vector2(40,60), // bay bottom
                new Vector2(40,100), // bay bottom
                new Vector2(-100,100), // bend bottom left
                new Vector2(-140,80), // bend bottom, right
                new Vector2(-260,-40), // bend top, bottom
                new Vector2(-280,-80), // bend top, top
                new Vector2(-280,-250), // top right
                new Vector2(-120,-250),
                new Vector2(-120,-160),
                new Vector2(-40,-80), // bay top
                new Vector2(40,-80), // bay top
                new Vector2(40,-40), // bay top
                new Vector2(80,-40), // bay top
                new Vector2(80,-80)
            ].reverse(), 123456
        );

        district.spawn = new Vector2(-95, -105);

        // generate central circle
        district.addCircle(new Vector2(-95, -105), 70, Angle.FromDegrees(45).radians(), 6);
        district.noSplit.push(new Vector2(-95, -105));

        // generate a block between the two bays left
        district.addCircle(new Vector2(60, 10), 92, Angle.FromDegrees(0).radians(), 4);

        // make some stuff on the left side
        district.addSite(new Vector2(260,-80), true, true, 80);
        //district_4.addSite(new Vector2(260,10), true, true, 80);
        //district_4.addSite(new Vector2(160,10), true, true, 80);
        district.addSite(new Vector2(260,100), true, true, 80);
        
        district.addRandomSites(25, 78415);

        district.center = new Vector2(-200, 300);

        district.teleportation_booths.push(new Vector2(-125, -75));
        district.teleportation_booths.push(new Vector2(105, 10));
        district.teleportation_booths.push(new Vector2(-220, -220));

        return district;
    }

    private generateDistrict5() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(-100, 100),
                new Vector2(10, 180),
                new Vector2(100, 180), // bottom left corner
                //new Vector2(70, 70), // bottom left corner center
                new Vector2(180, 70), // bottom left corner
                new Vector2(180, -60),
                new Vector2(100, -165),
                new Vector2(100, -250), // top
                new Vector2(10, -250), // top
                new Vector2(-60, -170),
                new Vector2(-60, -60), // inner corner
                new Vector2(-180, -60), // right
                new Vector2(-180, 100), // right
            ], 65897522, true, { minSize: 35, maxSize: 45 }
        );

        // generate central circle
        const central = new Vector2(50,100);
        district.addCircle(central, 60, Angle.FromDegrees(0).radians(), 4);
        district.noSplit.push(central);

        const central2 = new Vector2(50,-20);
        district.addCircle(central2, 80, Angle.FromDegrees(0).radians(), 4);
        district.noSplit.push(central2);

        // top blocks
        const top = new Vector2(55,-205);
        district.addCircle(top, 85, Angle.FromDegrees(0).radians(), 4);

        // make some stuff on the right side
        district.addSite(new Vector2(-180, 100), true, true, 100);
        district.exclusion.push(new ExclusionZone(new Vector2(-180, -60), 50));

        district.center = new Vector2(300, 300);
        district.spawn = new Vector2(50,-25);

        district.teleportation_booths.push(new Vector2(50, 10));
        district.teleportation_booths.push(new Vector2(10, -160));

        return district;
    }

    private generateDistrict6() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(-100, -100),
                new Vector2(10, -180),
                new Vector2(100, -180), // bottom left corner
                //new Vector2(70, -70), // bottom left corner center
                new Vector2(180, -70), // bottom left corner
                new Vector2(180, 60),
                new Vector2(100, 165),
                new Vector2(100, 250), // top
                new Vector2(10, 250), // top
                new Vector2(-60, 170),
                new Vector2(-60, 60), // inner corner
                new Vector2(-180, 60), // right
                new Vector2(-180, -100), // right
            ].reverse(), 458781, true, { minSize: 35, maxSize: 45 }
        );

        // generate central circle
        const central = new Vector2(-150,-65);
        district.addCircle(central, 60, Angle.FromDegrees(0).radians(), 4);
        district.exclusion.push(new ExclusionZone(central, 150));
        district.noSplit.push(central);

        const central2 = new Vector2(50,20);
        district.addCircle(central2, 80, Angle.FromDegrees(0).radians(), 4);
        district.noSplit.push(central2);

        // top blocks
        const top = new Vector2(55,205);
        district.addCircle(top, 85, Angle.FromDegrees(0).radians(), 4);
        
        district.addRandomSites(10, 98758);

        district.center = new Vector2(300, -300);
        district.spawn = central2;

        district.teleportation_booths.push(new Vector2(50, 60));
        district.teleportation_booths.push(new Vector2(-120, -90));

        return district;
    }

    // The upper left part of the ring
    private generateDistrict7() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(290,80), // top left
                new Vector2(290,10), // bay top left
                new Vector2(250,10), // bay top left
                new Vector2(250,-30), // bay top left
                new Vector2(290,-30), // bay top left
                new Vector2(290,-100), // bottom left
                new Vector2(-80,-100), // bend bottom left
                new Vector2(-20,80), // bay top
                
                //new Vector2(80,80)
            ], 123456, true
        );

        district.spawn = new Vector2(50, -10);

        // generate spawn
        district.addCircle(district.spawn, 55, Angle.FromDegrees(0).radians(), 6);
        district.noSplit.push(district.spawn);

        // make some stuff on the left side
        district.addCircle(new Vector2(270,-10), 50, Angle.FromDegrees(0).radians(), 4);

        district.center = new Vector2(-200, -300);

        district.teleportation_booths.push(new Vector2(22.5, -10));
        district.teleportation_booths.push(new Vector2(180, 75));

        return district;
    }

    // The upper right part of the ring
    private generateDistrict8() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(-100,-100), // bend bottom left
                new Vector2(-140-20,-80-20), // bend bottom, right
                new Vector2(-260-20,40-20), // bend top, bottom
                //new Vector2(-280,80), // bend top, top
                new Vector2(-280,320), // top right
                new Vector2(-120,320),
                new Vector2(-120,160),
                new Vector2(-40,80), // bay top

            ], 123456, true , { minSize: 35, maxSize: 45 }
        );

        district.spawn = new Vector2(-155, 45);

        // generate central circle
        district.addCircle(district.spawn, 50, Angle.FromDegrees(105).radians(), 6);
        district.noSplit.push(district.spawn);

        // generate a block between the two bays left
        district.addCircle(new Vector2(-250, 290), 50, Angle.FromDegrees(0).radians(), 4);
        district.noSplit.push(new Vector2(-250, 290));
        district.addCircle(new Vector2(-250+100, 290), 50, Angle.FromDegrees(0).radians(), 4);
        district.noSplit.push(new Vector2(-250+100, 290));
        district.addCircle(new Vector2(-250+50, 290+50), 50, Angle.FromDegrees(0).radians(), 4);

        district.center = new Vector2(-200, -300);

        district.teleportation_booths.push(new Vector2(-162.5, 17.5));
        district.teleportation_booths.push(new Vector2(-200, 240));

        return district;
    }

    private generateDistrict9() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(-90,-180),
                new Vector2(-130,-130),
                new Vector2(-130,130),
                new Vector2(-90,180),
                new Vector2(130,180),
                new Vector2(130,-180),
            ], 123456, true , { minSize: 35, maxSize: 45 }
        );

        district.spawn = new Vector2(0, 0);

        // generate central circle
        district.addCircle(district.spawn, 80, 0, 4);
        district.noSplit.push(district.spawn);

        district.addCircle(new Vector2(0, 150), 80, 0, 4);
        district.addCircle(new Vector2(0, -150), 80, 0, 4);

        district.center = new Vector2(580, 0);

        district.teleportation_booths.push(new Vector2(-40, 0));
        district.teleportation_booths.push(new Vector2(40, -120));
        district.teleportation_booths.push(new Vector2(125, 170));

        return district;
    }

    private generateDistrict10() {

        const district = new VoronoiDistrict(new Vector2(0,0),
            [
                new Vector2(-130,-180),
                new Vector2(-130,180),
                new Vector2(90,180),
                new Vector2(130,130),
                new Vector2(130,-130),
                new Vector2(90,-180),
            ], 123456, true , { minSize: 35, maxSize: 40 }
        );

        district.spawn = new Vector2(0, 75);

        // generate central circle
        district.addCircle(new Vector2(0, 75), 65, 0, 4);
        district.noSplit.push(new Vector2(0, 75));
        district.addCircle(new Vector2(0, -75), 65, 0, 4);
        district.noSplit.push(new Vector2(0, -75));

        //district.addCircle(new Vector2(0, 150), 80, 0, 4);
        //district.addCircle(new Vector2(0, -150), 80, 0, 4);

        district.center = new Vector2(840, 0);

        district.teleportation_booths.push(new Vector2(32.5, 75));
        district.teleportation_booths.push(new Vector2(-120, 0));
        district.teleportation_booths.push(new Vector2(45, -120));

        return district;
    }

    // Similar to componentDidMount and componentDidUpdate:
    override async componentDidMount() {
        const dim = 2000;

        const worldgen = new WorldGen();

        // First district
        const district_1 = this.generateDistrict1();
        worldgen.addDistrict(district_1);

        // Second district
        const district_2 = this.generateDistrict2();
        worldgen.addDistrict(district_2);

        // Third district
        const district_3 = this.generateDistrict3();
        worldgen.addDistrict(district_3);

        // Fourth district
        const district_4 = this.generateDistrict4();
        worldgen.addDistrict(district_4);

        // Fifth district
        const district_5 = this.generateDistrict5();
        worldgen.addDistrict(district_5);

        // sixth district
        const district_6 = this.generateDistrict6();
        worldgen.addDistrict(district_6);

        // seventh district
        const district_7 = this.generateDistrict7();
        worldgen.addDistrict(district_7);

        // eighth district
        const district_8 = this.generateDistrict8();
        worldgen.addDistrict(district_8);

        // ninth district
        const district_9 = this.generateDistrict9();
        worldgen.addDistrict(district_9);

        // tenth district
        const district_10 = this.generateDistrict10();
        worldgen.addDistrict(district_10);

        // Add birdges from district 1 to 2
        worldgen.addBridge(new Bridge(district_1, 3, 0.5, district_2, 2, 0.5));

        // Add birdges from district 3 to 2
        worldgen.addBridge(new Bridge(district_3, 8, 0.5, district_2, 4, 0.5));
        worldgen.addBridge(new Bridge(district_3, 7, 0.5, district_2, 5, 0.5));
        worldgen.addBridge(new Bridge(district_3, 6, 0.5, district_2, 6, 0.5));
        worldgen.addBridge(new Bridge(district_3, 5, 0.5, district_2, 0, 0.5));

        // Add birdges from district 3 to 1
        worldgen.addBridge(new Bridge(district_3, 9, 0.5, district_1, 0, 0.64));
        worldgen.addBridge(new Bridge(district_3, 4, 0.5, district_1, 6, 1-0.64));

        // Add birdges from district 4 to 1
        worldgen.addBridge(new Bridge(district_4, 17, 0.175, district_1, 7, 0.1));

        // Add birdges from district 4 to 3
        worldgen.addBridge(new Bridge(district_4, 17, 0.845, district_3, 3, 0.65));
        worldgen.addBridge(new Bridge(district_4, 3, 0.5, district_3, 3, 0.145));
        worldgen.addBridge(new Bridge(district_4, 4, 0.5, district_3, 2, 0.5));
        worldgen.addBridge(new Bridge(district_4, 5, 0.5, district_3, 1, 0.865));

        // Add birdges from district 5 to 1
        worldgen.addBridge(new Bridge(district_5, 9, 0.9, district_1, 7, 0.66));
        worldgen.addBridge(new Bridge(district_5, 8, 0.54, district_1, 8, 0.145));

        // Add birdges from district 5 to 3
        worldgen.addBridge(new Bridge(district_5, 10, 0.445, district_4, 16, 0.5));

        // Add birdges from district 6 to 1
        worldgen.addBridge(new Bridge(district_6, 1, 0.1, district_1, 13, 0.34));
        worldgen.addBridge(new Bridge(district_6, 2, 0.46, district_1, 12, 0.855));

        // Add birdges from district 5 to 6
        worldgen.addBridge(new Bridge(district_5, 6, 0.5, district_6, 4, 0.5));

        // Add birdges from district 7 to 3
        worldgen.addBridge(new Bridge(district_7, 7, 0.408, district_3, 10, 0.35));
        worldgen.addBridge(new Bridge(district_7, 7, 0.066, district_3, 10, 0.855));

        // Add birdges from district 7 to 1
        worldgen.addBridge(new Bridge(district_7, 7, 0.87, district_1, 13, 0.75));

        // Add birdges from district 7 to 6
        worldgen.addBridge(new Bridge(district_7, 0, 0.6, district_6, 0, 0.865));
        worldgen.addBridge(new Bridge(district_7, 4, 0.5, district_6, 0, 0.22));

        // Add birdges from district 7 to 8
        worldgen.addBridge(new Bridge(district_7, 6, 0.75, district_8, 6, 0.215));
        worldgen.addBridge(new Bridge(district_7, 6, 0.25, district_8, 6, 0.715));

        // Add birdges from district 8 to 3
        worldgen.addBridge(new Bridge(district_8, 5, 0.5, district_3, 0, 0.5));
        worldgen.addBridge(new Bridge(district_8, 4, 0.5, district_3, 1, 0.27));

        // Add birdges from district 8 to 4
        worldgen.addBridge(new Bridge(district_8, 3, 0.5, district_4, 6, 0.5));

        // Add birdges from district 9 to 5
        worldgen.addBridge(new Bridge(district_9, 1, 0.855, district_5, 5, 0.5));
        worldgen.addBridge(new Bridge(district_9, 2, 0.5, district_5, 4, 0.54));

        // Add birdges from district 9 to 6
        worldgen.addBridge(new Bridge(district_9, 1, 0.145, district_6, 5, 0.5));
        worldgen.addBridge(new Bridge(district_9, 0, 0.5, district_6, 6, 0.46));

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

        const last_minted_place_id = (await Contracts.countExteriorPlacesView(this.context)).minus(1).toNumber();

        const drawMap = (mark_minted: boolean = false) => {
            draw.clear();

            // Colors
            const lotFillColor = '#d6f0ff';
            const lotStrokeColor = '#3d8dba';
            const lotMintedFillColor = '#d6fff0';
            const lotMintedStrokeColor = '#3dba8d';
            const blockFillColor = '#eaeaea';
            const blockStrokeColor = '#777777'; // eslint-disable-line @typescript-eslint/no-unused-vars
            const districtFillColor = '#f6f6f6';
            const districtStrokeColor = '#888888';
            const bridgeColor = '#888888';
            const publicFillColor = '#d6ffd8';
            const publicStrokeColor = '#3dba41';
            const teleBoothFillColor = "lightcoral";
            const teleBoothStrokeColor = "red";
            const spawnFillColor = "skyblue";
            const spawnStrokeColor = "royalblue";

            // Draw the svg
            // TODO: figure out which way to flip the map...
            // TODO: lots should be realtive to blocks, blocks relative to districts.
            let lot_counter = 0;
            for (const district of worldgen.districts) {
                draw.polygon(district.verticesToArray(district.center)).fill(districtFillColor).stroke(districtStrokeColor).attr({'stroke-width': 0.5});

                for (const block of district.blocks) {
                    draw.polygon(block.verticesToArray(district.center)).fill(blockFillColor)/*.stroke(blockStrokeColor)*/.attr({'stroke-width': 0.5});

                    for (const lot of block.lots) {
                        if(lot.isValid()) {
                            const is_public = PublicPlaces.has(lot_counter);
                            const fill = is_public ? publicFillColor : (mark_minted && lot_counter <= last_minted_place_id) ? lotMintedFillColor : lotFillColor;
                            const stroke = is_public ? publicStrokeColor : (mark_minted && lot_counter <= last_minted_place_id) ? lotMintedStrokeColor : lotStrokeColor;

                            draw.polygon(lot.verticesToArray(district.center)).fill(fill).stroke(stroke).attr({'stroke-width': 0.5});
                            const centroid = lot.centroid(district.center);
                            draw.circle(1).fill(fill).stroke(stroke).move(centroid.x - 0.5, centroid.y - 0.5);

                            if(!mark_minted) {
                                const text = draw.text("Place #" + lot_counter).font({
                                    family: 'Arial', size: 1.5//, anchor: 'middle'//, leading: '1.5em'
                                }).fill('black');
                                text.move(centroid.x - text.bbox().w / 2, centroid.y + 1.5).scale(-1, 1);
                            }

                            ++lot_counter;
                        }
                    }
                }

                // Draw spawn and teleportation booths if preview
                if (mark_minted) {
                    for (const p of district.teleportation_booths) {
                        const pt = district.center.add(p);
                        draw.circle(5).fill(teleBoothFillColor).stroke(teleBoothStrokeColor).move(pt.x - 2.5, pt.y - 2.5);
                    }

                    const spawnt = district.center.add(district.spawn);
                    draw.circle(5).fill(spawnFillColor).stroke(spawnStrokeColor).move(spawnt.x - 2.5, spawnt.y - 2.5);
                }

                // Draw roads
                /*for (const road of district.roads)
                    draw.line(road.pointsToArray()).fill('red').stroke('red').attr({'stroke-width': 0.5});

                for (const curb of district.curbs)
                    draw.line(curb.pointsToArray()).fill('green').stroke('green').attr({'stroke-width': 0.5});*/
            }

            console.log("lot_counter", lot_counter);

            for (const bridge of worldgen.bridges) {
                draw.line(bridge.bridge_path[0].asArray().concat(bridge.bridge_path[1].asArray())).stroke(bridgeColor).attr({'stroke-width': 10});
            }

            return draw.svg();
        }

        const map_final = drawMap();

        /*const map_preview =*/ drawMap(true);

        this.setState({ worldgen: worldgen, svg: map_final, world_def: worldgen.serialise() });
    }

    override render(): React.ReactNode {
        return (
            <main className="container">
                <button className="btn btn-warning me-2" onClick={() => this.mintSpecialInteriors()}>Mint Special Interiors</button>
                <button className="btn btn-warning me-2" onClick={() => this.mintInteriors()}>Mint Interiors</button>
                <button className="btn btn-warning me-2" onClick={() => this.mintPlaces()}>Mint Places</button>
                <button className="btn btn-warning me-2" onClick={() => this.createAuctions()}>Create Auctions</button>
                <button className="btn btn-warning me-2" onClick={() => this.batchWhitelist()}>Whitelist</button>
                <button className="btn btn-warning me-2" onClick={() => this.batchPermissions()}>Permissions</button>
                <button className="btn btn-primary me-2" onClick={() => this.downloadSvgFile()}>Download SVG</button>
                <button className="btn btn-primary me-2" onClick={() => this.downloadDistrictsFile()}>Download Districts</button>
                <button className="btn btn-warning me-2" onClick={() => this.batchTransferPlaces()}>Batch Trasfer Places</button>
                <svg className="d-block" ref={this.svgRef}></svg>
            </main>
        );
    }
};