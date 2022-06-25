import { getSdk } from "./generated/user";
import { GraphQLClient } from "graphql-request";
import Conf from "../Config";

const gqpClient = new GraphQLClient(Conf.hasura_url);

export const grapphQLUser = getSdk(gqpClient);