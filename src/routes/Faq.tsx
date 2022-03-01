const faqData = [
    {
        title: 'General',
        id: 'general',
        items: [
            {
                question: "Are the smart contracts audited?",
                answer: <span>No, not yet. You know what that means.<br/><br/>I was as careful as can be, wrote test and all that. The contract source code is/will be available on <a target="_blank" rel="noreferrer" href="https://github.com/tz1and">GitHub</a>.<br/><br/>
                You may be wondering why the World contract source is missing, I will open source it once the DAO bootstrapping is done.</span>
            },
            {
                question: "Is this project open source?",
                answer: "The contracts are (or will be), so is the indexer. While the app itself isn't, at the time of writing, I intend to open it up after some time."
            },
            {
                question: "Is there a roadmap?",
                answer: `I have plenty of ideas for things to add, the Item data in the contracts is extensible and the contracts are upgradeable.
                
The next thing I'd like to do is 'proper multiplayer', so you can see and interact with others in the world. Maybe avatars? Interior places, etc, etc.`
            },
            {
                question: "What types of content are supported?",
                answer: "For now, only 3D models in GLTF format, but expect other multimedia content to follow. Images and audio."
            },
            {
                question: "Ever expanding, really?",
                answer: "That's the plan, yes. At a pace that is sensible and technically feasible. Keep in mind that there are always new technical limitations to be overcome.\n\nMostly web browsers..."
            },
            {
                question: "Can I show off other (FA2) NFTs in my Place, not just tz1and Items?",
                answer: "Yes, but not initially. The World contract has support for this.\n\nIt will be enabled at some point, it needs to implemented in the app."
            },
            {
                question: "I'm trying to mint an Item and it tells me it might not be displayed.",
                answer: `Well, there have to be some limits for this to work. If there are only a few multi-million polygon meshes in the world, it wouldn't.

The default limits aren't strictly enforced, they can be overridden in the settings, and are chosen conservatively to begin with. Depending on how things will go, they might be increased.

Until then, lowpoly has a nice aesthetic :)

I'll probably also add a "visit single Place" option, where you can link people to your place and it will load all the crazy stuff you put in there.`
            },
            {
                question: "So! What's the deal with the DAO?",
                answer: `This is important, and probably should have it's own section on the website.

Until the DAO bootstrapping is done (see DAO token section), the proceeds of Place auctions and market fees go to the manager (me), to fund the development, cover running costs, marketing and whatever else may come up.

Depending on how that goes, I may feed part of that into the DAO, but that's at my discretion.

After the DAO has been bootstrapped, the Place and market fees will be split 70/30 between to the DAO and the "core team" repectively.

(Clarification: fees will not be redistributed between DAO owners - see DAO token section for more.)

I more or less made this number up - and once we have some solid voting set up to pay contributors, I may change it to feed more into the DAO (but never the other way around, that will be ensured by the splitting contract).

I have to eat. But also, I live a rather humble life. Also, a pretty honest life. :)`
            }
        ]
    },
    {
        title: 'FA2 Tokens',
        id: 'token',
        items: [
            {
                question: "What's the 'tz1and Places' token?",
                answer: `It represents the Places you can own on tz1and. For now only exteriors, but interiors are planned.\n\nIt's a non-fungible multi-token.`
            },
            {
                question: "And the 'tz1and Items' token?",
                answer: `These are the Items you can mint, collect and show off in your Place in the virtual world.

A semi-fungible multi-token. The Item (meta)data is stored on IPFS.

The Items contract also has an owner-only burn function, if you ever feel like burning some tokens.`
            },
            {
                question: "There's this 'tz1and DAO' token...",
                answer: `The plan is to transition this into some sorf of community project, a 'decentralized autonomous organization', if you will.

Eventually, you will be able to use the DAO token to vote on proposals, changes to the world contracts global settings, how to spend the DAO funds (paying contributors, marketing, etc).

In quasi-legal terms: This is a non-profit.

From the day the DAO is bootstrapped (DAO tokens are not distributed immediately, to not over-advantage early adopters) to the cut-off date (bootstrap + 60 days), everyone participating gets DAO tokens for 'swaps'. The manager (me) gets 20% of all minted DAO tokens: for myself and to be distributed to other people getting involved. A team vote-fund.

Feel free to add liquidity, I (probably XD - joke, I won't throw away my vote) won't dump my tokens. But know that this will never be more than a DAO token - unless there's a vote, I suppose.`
            },
            {
                question: "Can I share my Place with a spouse/friend/stranger I met online?",
                answer: <span>Yes! You can!<br/><br/>

You can allow others to place their Items on in your Place by giving them permissions on your Place <b><i>in the World contract</i></b>. There are a couple of different permissions you can grant.<br/><br/>

Items always belong to who placed them. Items can always be removed from places by who placed them, even if permissions are removed.<br/><br/>

The World contract has permissions, kind similar to FA2 operators, but there is nothing to worry about, it does not grant any transfer rights on the Place token itself. No potential for broken marriages or ruined friendships. :)</span>
            }
        ]
    },
    {
        title: 'Other/Fun',
        id: 'other',
        items: [
            {
                question: "How is the name pronounced?",
                answer: "It's teee-zeee-one-and. Joke. It's Tezland."
            },
            {
                question: "Who made the logo? It's pretty good!",
                answer: <span>Fiyin made the logo. Follow him on Twitter: <a href="https://www.twitter.com/FiyinOdebunmi" rel="noreferrer" target="_blank" >twitter.com/FiyinOdebunmi</a></span>
            },
            {
                question: "I saw a mint function and I think this is a rug!",
                answer: `You must be in some kind of parallel universe right now.`
            },
            {
                question: "Who's on the team?",
                answer: "Only me right now, feel free to involve yourself!"
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
                <div id={`panel-collapse-${cat.id}-${itemIdx}`} className="accordion-collapse collapse" data-bs-parent="#accordionFlush" aria-labelledby={`panel-heading-${cat.id}-${itemIdx}`}>
                    <div className="accordion-body" style={{whiteSpace: "pre-wrap"}}>
                        {item.answer}
                    </div>
                </div>
            </div>);
        });

        
        categories.push(<div className="col col-8 col-xl-6 col-xxl-4 flex-grow-1 flex-lg-grow-0" key={cat.id}>
            <h2 className="ps-2 pt-3">{cat.title}</h2>
            <div className="accordion accordion-flush">
                {items}
            </div>
        </div>)
    })

    return (
        <main>
            <div className="container px-4 py-4">
                <h1 className="text-center">Frequently Asked Questions</h1>
                <div className="row mt-3 pt-3 justify-content-center" id="accordionFlush">
                    {categories}
                </div>
            </div>
        </main>
    );
}