type LoadingProps = {
    height?: string
}

const Loading: React.FC<LoadingProps> = (props) => <div className="d-flex justify-content-center align-items-center" style={{height: props.height ? props.height : "100vh"}}>
    <div className="spinner-border text-primary" style={{width: "6rem", height: "6rem"}} role="status">
        <span className="visually-hidden">Loading...</span>
    </div>
</div>;

export default Loading;