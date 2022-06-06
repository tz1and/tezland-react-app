import { truncateAddress } from "../utils/Utils";
import { useTezosWalletContext } from "./TezosWalletContext";
import { OverlayTrigger, Popover } from "react-bootstrap";

export default function WalletWidget() {
    const context = useTezosWalletContext();

    return (
        context.isWalletConnected() ?
            <div className="btn-group" role="group" aria-label="Basic example">
                <button className="btn btn-dark mb-auto ms-3 px-2"><i className="bi bi-wallet2"></i></button>

                <OverlayTrigger
                    placement={"bottom"}
                    trigger={"focus"}
                    overlay={
                        <Popover>
                            <Popover.Body>
                                Copied!
                            </Popover.Body>
                        </Popover>
                    }
                >
                    <button id="wallet-address-button" className="btn btn-light btn-outline-dark mb-auto px-2"
                        onClick={() => navigator.clipboard.writeText(context.walletPHK())}>{truncateAddress(context.walletPHK())}</button>
                </OverlayTrigger>

                <button className="btn btn-primary mb-auto" onClick={() => context.disconnectWallet()}>Disconnect Wallet</button>
            </div> :
            <button className="btn btn-success mb-auto ms-3" onClick={() => context.connectWallet()}>Connect Wallet</button>
    );
}