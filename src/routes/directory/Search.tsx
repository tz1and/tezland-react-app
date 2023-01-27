import React, { useRef, useState } from 'react';
import { Button, InputGroup, Form, Row, Col, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FetchDataFunc, FetchDataResultArray, TokenInfiniteScroll, ItemClickedFunc } from '../../components/TokenInfiniteScroll';
import { InventoryItem } from '../../components/InventoryItem';
import { SearchByStringsQuery } from '../../graphql/generated/user';
import { grapphQLUser } from '../../graphql/user';
import { DirectoryUtils } from '../../utils/DirectoryUtils';
import TokenKey from '../../utils/TokenKey';
import { assert } from '../../utils/Assert';


type SearchProps = { };

type SearchState = {
    result?: SearchByStringsQuery | undefined;
};

export const Search: React.FC<SearchProps> = (props) => {
    const navigate = useNavigate();
    const inputFieldRef = useRef<HTMLInputElement>(null);

    const [state, setState] = useState<SearchState>({});

    const handleClick: ItemClickedFunc = (token_key: TokenKey, quantity?: number) => {
        // TODO: should link to fa2/tokenid
        navigate(DirectoryUtils.itemLink(token_key));
    }

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            search();
        }
    }

    const search = async () => {
        setState({result: undefined});

        assert(inputFieldRef.current);
        const input = inputFieldRef.current.value.split(' ');
        const inputArr = [];

        for (const i of input) {
            const trimmed = i.trim();
            if (trimmed.length > 0)
                inputArr.push(trimmed);
        }

        if (inputArr.length > 0) {
            const regex_terms = `(${inputArr.join('|')})`;

            const res = await grapphQLUser.searchByStrings({regex_terms: regex_terms});

            setState({result: res});
        }
    }

    const processItemsByUserResult: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        if (!state.result) return [];

        const results = state.result.itemToken;

        // format so it fits the result the format the token components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results.slice(dataOffset, dataOffset + fetchAmount)) {
            formatted.push({token: res});
        }

        return formatted;
    }

    const processItemsResult: FetchDataFunc = async (dataOffset: number, fetchAmount: number): Promise<FetchDataResultArray> => {
        if (!state.result) return [];

        const results = state.result.itemTokenMetadata;

        // format so it fits the result the format the token components expect.
        const formatted: FetchDataResultArray = []
        for (const res of results.slice(dataOffset, dataOffset + fetchAmount)) {
            formatted.push({token: res.token[0]});
        }

        return formatted;
    }

    // format results...

    let tagResults: JSX.Element[] = [];
    let accountResults: JSX.Element[] = [];

    if (state.result) {
        for (const tag of state.result.tag) {
            tagResults.push(
                <Link key={tag.name} to={DirectoryUtils.tagLink(tag.name)}>
                    <Badge pill bg="primary" className="me-1">
                        {tag.name}
                    </Badge>
                </Link>
            );
        }

        for (const holder of state.result.holder) {
            accountResults.push(
                <Link key={holder.address} className="me-1 d-block" to={DirectoryUtils.userLink(holder.address)}>
                    {holder.address}
                </Link>
            );
        }
    }

    return (
        <main>
            <div className="position-relative container text-start mt-4">
                <h1>Search</h1>
                <Row>
                    <Col xs={12} sm={8} md={6} lg={4}>
                        <InputGroup className="mb-3">
                            <Form.Control type="text" placeholder="Enter search terms" ref={inputFieldRef} onKeyDown={handleKeyDown} />
                            <Button variant="primary" onClick={search}>
                                Search
                            </Button>
                        </InputGroup>
                    </Col>
                </Row>

                {tagResults.length > 0 && <div className='mb-3'><h4>Tags</h4>{tagResults}</div>}

                {accountResults.length > 0 && <div className='mb-3'><h4>Users</h4>{accountResults}</div>}

                {state.result && state.result.itemToken.length > 0 &&
                    <div className='mb-3'><h4>Items by User</h4><TokenInfiniteScroll fetchDataFunc={(dataOffset: number, fetchAmount: number) => processItemsByUserResult(dataOffset, fetchAmount)} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/></div>}

                {state.result && state.result.itemTokenMetadata.length > 0 &&
                    <div className='mb-3'><h4>Items</h4><TokenInfiniteScroll fetchDataFunc={(dataOffset: number, fetchAmount: number) => processItemsResult(dataOffset, fetchAmount)} handleClick={handleClick} fetchAmount={20} component={InventoryItem}/></div>}
            </div>
        </main>
    );
}
