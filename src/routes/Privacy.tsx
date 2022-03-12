import { PrivacyStatement } from "../TermsAndPrivacy";

export default function Privacy() {
    return (
        <main>
            <div className="container px-4 py-4">
                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <h1 className="text-center mb-4">Privacy Policy</h1>
                        {PrivacyStatement}
                    </div>
                </div>
            </div>
        </main>
    );
}