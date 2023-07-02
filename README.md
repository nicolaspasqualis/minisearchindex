# minisearchindex

**DEMO** of a minimal document search utility.

## Features

- Classic inverted search index.

- Simple API which makes it trivial to extend with different datastores depending on performance requirements.

- Includes a redis backed inverted index and a mongodb document store as example implementations.

- Supports streams to minimize memory use while ingesting new documents.

## Usage

Example of an instance backed by in-memory stores, which might be enough for certain usecases.

```typescript
const si = SearchIndex(InMemoryDocumentStore(), InMemoryInvertedIndex());
```

In real-world use cases where large lists of documents need to be added, using the provided streaming methods will avoid unnecessary memory usage while indexing

```typescript
const exampleSourceStream = Readable.from([
    "The inverted index data structure is a central component of search algorithms.",
    "A goal of a search engine implementation is to optimize the speed of the query.",
    "For example: Find the documents where word X occurs."
]);

await si.addDocumentsStream(exampleSourceStream);

const result = await si.findWithWords(["the", "search"]);
//  result = [
//    "The inverted index data structure is a central component of search algorithms",
//    "A goal of a search engine implementation is to optimize the speed of the query"
//  ]
```
Depending on the size/number of the documents and the system's available resources, using external datastores might be preferred.
Adding different document and inverted index stores is trivial. 

Example using the provided `RedisInvertedIndex` and `MongoDocumentStore`:

```typescript
// Initialize a MongoDocumentStore using mongodb's MongoClient
const mongoClient = new MongoClient('mongodb://localhost:27017');
await mongoClient.connect();
const collection = mongoClient.db('example').collection('documents');

const store = MongoDocumentStore(collection);

// Initialize a RedisInvertedIndex with a node-redis Client
const redisClient = createClient();
redisClient.on('error', err => { console.log(err) });
await redisClient.connect();

const index = RedisInvertedIndex(redisClient);

const si = SearchIndex(documentStore, index);

await si.addDocuments([
    "The inverted index data structure is a central component of search algorithms.",
    "A goal of a search engine implementation is to optimize the speed of the query.",
    "For example: Find the documents where word X occurs."
]);

const result = await si.findWithWords(["search"]);
```
Example of a custom DocumentStore implementation:

```typescript
export const MongoDocumentStore = (collection: Collection): DocumentStore => {
  return {
    storeDocument: async (document: string): Promise<DocumentId> => {
      const result = await collection.insertOne({ content: document });
      return result.insertedId.toString();
    },
    getDocuments: async (ids: DocumentId[]): Promise<string[]> => {
      const objectIds = ids.map(id => new ObjectId(id));
      const documents = await collection.find({ _id: { $in: objectIds } }).toArray();
      return documents.map(doc => doc.content);
    }
  }
}
```

## Testing
An environment with docker-compose is necessary to run the current E2E tests.


```bash
npm run tests
```

```bash
Initializing test containers:

 Network minisearchindex_default  Creating
 Network minisearchindex_default  Created
 Container minisearchindex-redis-1  Creating
 Container minisearchindex-mongodb-1  Creating
 Container minisearchindex-redis-1  Created
 Container minisearchindex-mongodb-1  Created
 Container minisearchindex-mongodb-1  Starting
 Container minisearchindex-redis-1  Starting
 Container minisearchindex-mongodb-1  Started
 Container minisearchindex-redis-1  Started

PASS ./index.test.ts
  SearchIndex using in-memory stores
    √ should find a single document (5 ms)
    √ should not find documents when none contain all words (1 ms)
    √ should find documents when words have different casing (1 ms)
    √ should not find documents for partially matching words (1 ms)
  SearchIndex using redis and mongodb stores
    √ should find a single document (8 ms)
    √ should not find documents when none contain all words (5 ms)
    √ should find documents when words have different casing (4 ms)
    √ should not find documents for partially matching words (4 ms)

```

## Possible further improvements
- Support for adding multiple words per document in a single call to InvertedDocumentIndex could take advantage of the underlying datastore. Currently the redis and the in-memory implementation wont be benefitted by this.
- Support for multiple workers during the document ingestion/indexing process could improve performance for large lists.
- Performance benchmarks, more tests, ?