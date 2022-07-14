import { useLocation } from 'react-router-dom'
import { useLayoutEffect } from 'react'

interface ScrollToTopProps { }

const ScrollToTop = (props: React.PropsWithChildren<ScrollToTopProps>) => {
    const location = useLocation();
    useLayoutEffect(() => {
        document.documentElement.scrollTo(0, 0);
    }, [location.pathname]);
    return <div>{props.children}</div>;
};

export default ScrollToTop;
