import { Button, Col, Row } from "react-bootstrap";
import { Helmet } from "react-helmet-async";
import image_framer from '../img/image_framer.webp';
import building_maker from '../img/building_maker.webp';


export default function Tools() {
    return (
        <main className="container px-4 py-4">
            <Helmet>
                <title>tz1and - Tools</title>
            </Helmet>
            <h1 className='display-1'>Tools</h1>

            <Row xs={1} md={2}>
                <Col>
                    <div className="mx-auto mx-md-0">
                        <a href="https://framer.tz1and.com" target="_blank" rel="noreferrer noopener">
                            <img src={image_framer} className="d-block img-fluid rounded-3 shadow" alt="Bootstrap Themes" width="700"
                                height="500" loading="lazy" />
                        </a>
                    </div>
                    <div className="mt-3 mb-5">
                        <h1>Image Framer</h1>
                        <p className="lead">
                            By NoRulesJustFeels - <a className="link-secondary" href="https://github.com/NoRulesJustFeels/image-framer" target="_blank" rel="noreferrer noopener">GitHub Repo</a>.<br/>
                            Frames images in a 3d frame.<br/>
                            <Button size="lg" className="mt-2" as={"a"} href="https://framer.tz1and.com" target="_blank" rel="noreferrer noopener">Open Image Framer</Button>
                        </p>
                    </div>
                </Col>
                <Col>
                    <div className="mx-auto mx-md-0">
                        <a href="https://building.tz1and.com" target="_blank" rel="noreferrer noopener">
                            <img src={building_maker} className="d-block img-fluid rounded-3 shadow" alt="Bootstrap Themes" width="700"
                                height="500" loading="lazy" />
                        </a>
                    </div>
                    <div className="mt-3 mb-5">
                        <h1>Building Maker</h1>
                        <p className="lead">
                            By NoRulesJustFeels - <a className="link-secondary" href="https://github.com/NoRulesJustFeels/building-maker" target="_blank" rel="noreferrer noopener">GitHub Repo</a>.<br/>
                            Procedurally generated buildings that fit your place.<br/>
                            <Button size="lg" className="mt-2" as={"a"} href="https://building.tz1and.com" target="_blank" rel="noreferrer noopener">Open Building Maker</Button>
                        </p>
                    </div>
                </Col>
            </Row>
        </main>
    );
}