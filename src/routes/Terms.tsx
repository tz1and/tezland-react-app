import { TermsAndConditions } from "../TermsAndPrivacy";

export default function Terms() {
    return (
        <main>
            <div className="container px-4 py-4">
                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <h1 className="text-center mb-4">Terms</h1>
                        {TermsAndConditions}
                    </div>
                </div>
            </div>
        </main>
    );
}