import CBuffer from "CBuffer";
import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, InputGroup } from "react-bootstrap";
import { truncateAddress } from "../../utils/Utils";
import { AppControl, ChatMessage, OverlayForm } from "../../world/AppControlFunctions";


type ChatProps = {
    overlayState: OverlayForm;
    appControl: AppControl;
    sendMsg: (msg: string) => void;
};

function sendChatMessage(sendMsg: (msg: string) => void, ref: MutableRefObject<HTMLInputElement | null>) {
    const input = ref.current;
    if (input && input.value.length > 0) {
        sendMsg(input.value);
        input.value = "";
    }
}

function scrollChatToBottom(ref: MutableRefObject<HTMLDivElement | null>) {
    const div = ref.current;
    if(div) {
        const scroll = div.scrollHeight - div.clientHeight;
        div.scrollTo(0, scroll);
    }
};

// Workaround to be able to use the same buffer with
// a new object for updating the state.
type ChatBufferState = {
    buffer: CBuffer<ChatMessage>;
}

export const Chat: React.FC<ChatProps> = (props) => {
    const chatActive = props.overlayState === OverlayForm.Instructions;
    const chatVisible = props.overlayState === OverlayForm.Instructions || props.overlayState === OverlayForm.None;

    const inputRef = useRef<HTMLInputElement>(null);
    const messageContainer = useRef<HTMLDivElement>(null);

    const [chatMessageBuffer, setChatMessageBuffer] = useState<ChatBufferState>({buffer: new CBuffer<ChatMessage>(128)});

    const addChatMessage = useCallback((msg: ChatMessage) => {
        chatMessageBuffer.buffer.push(msg);
        setChatMessageBuffer({buffer: chatMessageBuffer.buffer});
        scrollChatToBottom(messageContainer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        //Logging.InfoDev("running Chat::useEffect");
        props.appControl.newChatMessage.subscribe(addChatMessage)
        return () => {
            //Logging.InfoDev("unsubscribing from newChatMessage");
            props.appControl.newChatMessage.unsubscribe(addChatMessage);
        }
    }, [addChatMessage, props.appControl]);

    return (
        <div>
            {chatVisible && <div className={`position-absolute chatPanel ${!chatActive && 'chatPanelInactive'}`}>
                <Card className={`chatCard ${!chatActive && 'chatCardInactive'}`}>
                    <Card.Header>Chat</Card.Header>
                    <Card.Body className='messageContainer' ref={messageContainer}>
                        {chatMessageBuffer.buffer.map((msg, idx) => {return <p className='m-1' key={idx}><b>{msg.from ? truncateAddress(msg.from) : "System"}</b>: {msg.msg}</p>}).toArray()}
                    </Card.Body>
                    {chatActive && <Card.Footer>
                        <InputGroup>
                            <input autoComplete="off" type="text" ref={inputRef} name="chat-input" className="form-control chatInput" placeholder="Type your message..." onKeyDown={(e) => e.key === 'Enter' && sendChatMessage(props.sendMsg, inputRef)} />
                            <Button disabled={!chatActive} onClick={() => sendChatMessage(props.sendMsg, inputRef)}>Send</Button>
                            {/*<div className='text-center w-100 m-0 mt-2 p-1 rounded bg-warning-light'>Don't give away sensitive information like passwords or seed phrases.</div>*/}
                        </InputGroup>
                    </Card.Footer>}
                </Card>
            </div>}
        </div>
    )
}