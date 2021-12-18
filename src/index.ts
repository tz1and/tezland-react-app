
import Contracts from "./tz/Contracts";
import { World } from "./World/World";
import { TempleWallet } from "@temple-wallet/dapp";

const world = new World();

TempleWallet.onAvailabilityChange((avail) => { Contracts.initWallet() });

(async function() {
    await world.playerController.setCurrentItem(2);
    await world.loadPlace(0);
    await world.loadPlace(1);
    await world.loadPlace(2);

    const place = world.places.get(1);
    if(place) world.playerController.setCurrentPlace(place);
})();
