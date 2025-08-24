import {MongoClient, ServerApiVersion} from 'mongodb';
const uri = "mongodb://localhost:27017/"

export const client = new MongoClient(uri, {
    serverapi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
})