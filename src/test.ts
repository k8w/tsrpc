import { ObjectId } from "bson";

type X = { new(): any };
let x: X = ObjectId;