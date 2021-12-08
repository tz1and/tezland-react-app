
import Contracts from "./tz/Contracts";
import { World } from "./World/World";
import { TempleWallet } from "@temple-wallet/dapp";

const world = new World();

TempleWallet.onAvailabilityChange((avail) => { Contracts.initWallet() });

(async function() {
    await world.loadPlace(0);
    await world.loadPlace(1);
})();
