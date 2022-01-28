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
                question: "Got a roadmap?",
                answer: "I have plenty of ideas for things to add, the Item data in the contracts is extensible and the contracts are upgradeable."
            },
            {
                question: "How is the name pronounced?",
                answer: "It's teee-zeee-one-and. But only if you are dope. For everyone else it's Tezland."
            },
        ]
    },
    {
        title: 'FA2 Tokens',
        id: 'token',
        items: [
            {
                question: "I saw a mint function and I think this is a rug.",
                answer: `You must be in some kind of parallel universe right now.`
            }
        ]
    },
    {
        title: 'Team',
        id: 'team',
        items: [
            {
                question: "Who's on the team?",
                answer: "Oh, it's just me."
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
                    <div className="accordion-body">
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