import { ObjectId } from 'mongodb';
import { OmitUnion } from 'k8w-extend-native';

type InsertOneResult<T> = any;
type OptionalId<T> = any;
type Document = any;

declare module 'mongodb' {
    export interface Collection<TSchema extends Document = Document> {
        insertOne(doc: OptionalUnlessRequiredId_1<TSchema>): Promise<InsertOneResult<TSchema>>;
    }
    export type OptionalUnlessRequiredId_1<TSchema> = TSchema extends {
        _id: ObjectId;
    } ? (OmitUnion<TSchema, '_id'> & { _id?: ObjectId }) : TSchema extends {
        _id: any;
    } ? TSchema : OptionalId<TSchema>;
}