const faqData = [
    {
        title: 'General',
        id: 'general',
        items: [
            {
                question: "Are the smart contracts audited?",
                answer: "No, not yet. I was as careful as can be. The contract source code is available on my GitHub: ",
                link: "https://github.com/852Kerfunkle/tezland-contracts"
            },
            {
                question: "Is this open source?",
                answer: "The contracts are, so is the indexer. While the dApp isn't open source at the time of writing, I intend to open it up after some time."
            },
            {
                question: "Got a roadmap?",
                answer: "I have plenty of ideas for things to add, the Item data in the contracts is extensible and the contracts are upgradeable."
            },
            {
                question: "How is the name pronounced?",
                answer: "It's teee-zeee-one-and. Joke. It's Tezland."
            }
        ]
    },
    {
        title: 'FA2 Tokens',
        id: 'token',
        items: [
            {
                question: "What's the 'tz1aND Places' token?",
                answer: `It represents the Places you can own on tz1aND.\n\nIt's a non-fungible multi-token.`
            },
            {
                question: "And the 'tz1aND Items' token?",
                answer: `These are the Items you can mint, collect and show off in your Place in the virtual world.

A fungible multi-token. The Items data is stored on IPFS. The Item token also has a burn function, if you ever feel like burning some tokens.`
            },
            {
                question: "There's this 'tz1aND DAO' token...",
                answer: `The plan is to transition this into some sorf of community project, a 'decentralized autonomous organization', if you will.

Eventually, you will be able to use the DAO token to vote on proposals.

Until the cut-off date, everyone participating get's tokens for 'swaps'. The manager (me) gets 20% of all minted DAO tokens, to ensure I get a decent voting power.

Feel free to add liquidity, I (probably) won't dump my tokens. But know that this will never be more than a DAO - unless there's a vote, I suppose.`
            },
            {
                question: "Can you share a Place?",
                answer: `Yes!\n\nYou can allow others to place their Items on in your Place by adding them them as operatos on your Place token.`
            }
        ]
    },
    {
        title: 'Other/Fun',
        id: 'other',
        items: [
            {
                question: "Who's on the team?",
                answer: "Just me right now, feel free to involve yourself!"
            },
            {
                question: "I saw a mint function and I think this is a rug!",
                answer: `You must be in some kind of parallel universe right now.`
            }
        ]
    }
]

export default function Faq() {

    const categories: JSX.Element[] = []

    faqData.forEach((cat: any, catIdx: number) => {
        const items: JSX.Element[] = []

        cat.items.forEach((item: any, itemIdx: number) => {
            items.push(<div className="accordion-item" key={itemIdx}>
                <h2 className="accordion-header" id={`panel-heading-${cat.id}-${itemIdx}`}>
                    <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target={`#panel-collapse-${cat.id}-${itemIdx}`} aria-expanded="false" aria-controls={`panel-collapse-${cat.id}-${itemIdx}`}>
                        {item.question}
                    </button>
                </h2>
                <div id={`panel-collapse-${cat.id}-${itemIdx}`} className="accordion-collapse collapse" aria-labelledby={`panel-heading-${cat.id}-${itemIdx}`}>
                    <div className="accordion-body" style={{whiteSpace: "pre-wrap"}}>
                        {item.answer} {item.link ? <a href={item.link} target="_blank" rel="noreferrer">{item.link}</a> : null}
                    </div>
                </div>
            </div>);
        });

        
        categories.push(<div className="col col-xxl-8 " key={cat.id}>
            <h2 className="ps-2 pt-3">{cat.title}</h2>
            <div className="accordion" id="accordionPanelsStayOpenExample">
                {items}
            </div>
        </div>)
    })

    return (
        <main>
            <div className="container px-4 py-4">
                <h1 className="text-center">Frequently Asked Questions</h1>
                <div className="row mt-3 pt-3 justify-content-center">
                    {categories}
                </div>
            </div>
        </main>
    );
}