import React from "react";
import { PropsWithChildren } from "react";
import TezosWalletContext from "./TezosWalletContext";
import { OperationPending, OperationPendingData } from "./OperationPending";


type TezosWalletProviderProps = {} & PropsWithChildren;

type TezosWalletProviderState = {
    pendingOps: OperationPendingData[];
    counter: number;
}

export default class TezosWalletOperations extends React.Component<TezosWalletProviderProps, TezosWalletProviderState> {
    static override contextType = TezosWalletContext;
    declare context: React.ContextType<typeof TezosWalletContext>;

    constructor(props: TezosWalletProviderProps) {
        super(props);
        this.state = {
            pendingOps: [],
            counter: 0
        }
    }

    override componentDidMount(): void {
        this.context.walletEvents().addListener("walletChange", this.walletChange);
        this.context.walletEvents().addListener("addOperation", this.addOperation);
        this.context.walletEvents().addListener("operationDone", this.operationDone);
    }

    override componentWillUnmount(): void {
        this.context.walletEvents().removeListener("walletChange", this.walletChange);
        this.context.walletEvents().removeListener("addOperation", this.addOperation);
        this.context.walletEvents().removeListener("operationDone", this.operationDone);
    }

    private addOperation = (hash: string) => {
        this.setState({ pendingOps: this.state.pendingOps.concat({hash: hash, done: false }) });
    }

    private removePendingOpetation = (hash: string) => {
        const newPending: OperationPendingData[] = [];
        for(const p of this.state.pendingOps) {
            if(p.hash !== hash) newPending.push(p);
        }
        this.setState({ pendingOps: newPending });
    }

    private operationDone = (hash: string, completed: boolean, message?: string) => {
        const elem = this.state.pendingOps.find((v) => v.hash === hash);
        if(elem) {
            elem.done = true;
            elem.success = completed;
            elem.error = message;

            this.setState({ counter: this.state.counter + 1 });

            // warnign: dangling timeout.
            setTimeout(() => {
                this.removePendingOpetation(hash);
            }, 30000);
        }
    }

    private walletChange = () => {
        // TODO: this is a workaround to force the component tree to update.
        // Components should subscribe to TezosWalletContext.walletChange.
        this.setState({ counter: this.state.counter + 1 });
    }

    override render() {
        let toasts = this.state.pendingOps.map(v => { return <OperationPending data={v} key={v.hash} /> });

        return (
            <div>
                {this.props.children}
                <div className="toast-container position-fixed bottom-0 end-0 p-5 px-4" style={{zIndex: "1050"}}>{toasts}</div>
            </div>
        )
    }
}