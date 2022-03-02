export default function Privacy() {
    return (
        <main>
            <div className="container px-4 py-4">
                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <h1 className="text-center mb-4">Privacy Policy</h1>
                        <p>
                            This website does not utilise tracking cookies (analytics or otherwise) and does not store any personalised data, aside from (temporary) web-server logs containing IP addresses.
                        </p>
                        <p>
                            We (tz1and) won't sell, publish or pass on any of the - incidentally and temporarily - collected data.
                        </p>
                        <small>
                            <u>Other data stored and used:</u><br/>
                            It's probably worth noting that some (not very sensitive) data is stored locally in your browser, including wallet public key hashes.
                            Also, the smart contracts store public key hashes and the "multiplayer" component uses public key hashes and signatures to authenticate users.
                            This should be beyond the usual scope of a privacy policy, just for your information and the sake of transparency.
                        </small>
                    </div>
                </div>
            </div>
        </main>
    );
}