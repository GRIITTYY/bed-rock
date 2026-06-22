import { Client, Databases, Account, Storage, Query, ID } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('bedrock');

export const databases = new Databases(client);
export const account = new Account(client);
export const storage = new Storage(client);

export const DB_ID = 'bedrock-db';
export const COLL_PADMIN = 'padmin';
export const COLL_BUILDING = 'building';
export const COLL_ROOM = 'room';
export const COLL_BOOKING = 'booking';
export const COLL_REVIEW = 'review';
export const BUCKET_ID = 'pictures';

export { Query, ID };
