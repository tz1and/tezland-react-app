import { WorldDefinition } from "../worldgen/WorldGen";
import world_definition_plain from "../models/districts.json";

//export const ImportedWorldDef = Object.assign(new WorldDefinition(), world_definition_plain);
export const ImportedWorldDef = Object.setPrototypeOf(world_definition_plain, WorldDefinition.prototype) as WorldDefinition;

// TODO: use typedjson for serialisation of WorldDefinition. https://www.npmjs.com/package/typedjson