export default function Faq() {
    return (
        <main>
            <div className="container px-4 my-5 py-5">
                <h1 className="display-5 fw-bold text-center">Frequently Asked Questions</h1>
                <div className="row mt-3 pt-3 justify-content-center">
                    <div className="col col-xxl-8 ">
                        {/* TODO: I suppose I leave this for later
                        {% for faqCategory in faq.categories %}
                            <h2 className="ps-2 pt-3">{{faqCategory.title}}</h2>
                            <div className="accordion" id="accordionPanelsStayOpenExample">
                                {% for faqItem in faqCategory.items %}
                                    {% include "partials/faq_item.njk" %}
                                {% endfor %}
                            </div>
                        {% endfor %}*/}
                    </div>
                </div>
            </div>

            {/*todo: figure this out later
            <script>
            {window.addEventListener("load", function(event) {
                if (location.hash !== null && location.hash !== "") {
                    console.log(location);
                    var elem = $('#panel-collapse-' + location.hash.substring(1));
                    elem.collapse("show");

                    elem.get(0).scrollIntoView(true);
                }
            });
            </script>*/}

        </main>
    );
}