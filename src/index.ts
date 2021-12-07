
import { Tezos } from "./tz/Tezos";
import { World } from "./World/World";

const world = new World();

(async function() {
    await world.loadPlace(0);
    await world.loadPlace(1);
})();

var tez = new Tezos();
tez.init();