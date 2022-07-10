import { Accordion } from 'react-bootstrap';
import acknowledgements from '../acknowledgements.json';
import acknowledgementsStatic from '../acknowledgements-static.json';


export default function Acknowledgements() {
    const elements: JSX.Element[] = []

    for (const [index, dep] of acknowledgementsStatic.concat(acknowledgements).entries()) {
        elements.push(<Accordion.Item eventKey={index.toString()}>
            <Accordion.Header>{dep.name} - {dep.licenses}</Accordion.Header>
            <Accordion.Body>
                <p><a target="_blank" rel="noreferrer" href={dep.repoLink}>Repository</a></p>
                <p style={{whiteSpace: "pre-wrap"}}>{dep.licenseFile}</p>
            </Accordion.Body>
        </Accordion.Item>);
    }

    return (
        <main>
            <div className="container px-4 py-4">
                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <h1 className="text-center mb-4">Acknowledgements</h1>
                        <p>These are the open source libraries used to make tz1and (direct dependencies only):</p>
                        <Accordion>{elements}</Accordion>
                    </div>
                </div>
            </div>
        </main>
    );
}