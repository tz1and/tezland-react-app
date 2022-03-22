import { truncate } from "../utils/Utils";
import { useTezosWalletContext } from "./TezosWalletContext";
import { Popover } from 'bootstrap';
import { useEffect, useRef } from "react";

export default function WalletWidget() {
    const context = useTezosWalletContext();

    const popoverRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        if(popoverRef.current) {
            const popover = new Popover(popoverRef.current, {
                content: "Copied!",
                placement: 'bottom',
                trigger: 'focus'
            });

            return () => {
                popover.dispose();
            }
        }

        return;
    })

    return (
        context.isWalletConnected() ?
            <div className="btn-group" role="group" aria-label="Basic example">
                <button className="btn btn-dark mb-auto ms-3 px-2"><i className="bi bi-wallet2"></i></button>
                <button id="wallet-address-button" className="btn btn-light btn-outline-dark mb-auto px-2" ref={popoverRef}
                    onClick={() => navigator.clipboard.writeText(context.walletPHK())}>{truncate(context.walletPHK(), 10, '\u2026')}</button>
                <button className="btn btn-primary mb-auto" onClick={() => context.disconnectWallet()}>Disconnect Wallet</button>
            </div> :
            <button className="btn btn-success mb-auto ms-3" onClick={() => context.connectWallet()}>Connect Wallet</button>
    );
}