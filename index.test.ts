import { Readable } from 'stream';
import { RedisClientType, createClient } from 'redis';
import { MongoClient } from 'mongodb';
import { 
  InMemoryDocumentStore, 
  InMemoryInvertedIndex, 
  MongoDocumentStore, 
  RedisInvertedIndex,
  SearchIndex 
} from './index';

const baseTests = (getInstance: () => SearchIndex) => {
  it('should find a single document', async () => {
    const words = ["document", "single", "sentence"];
    const result = await getInstance().findWithWords(words);
    const expected = ["Example document with a single sentence"];
    expect(result).toEqual(expected);
  });

  it('should not find documents when none contain all words', async () => {
    const words = ["single", "punctuation"];
    const result = await getInstance().findWithWords(words);
    const expected: string[] = [];
    expect(result).toEqual(expected);
  });

  it('should find documents when words have different casing', async () => {
    const words = ["example", "DOCUMENT"];
    const result = await getInstance().findWithWords(words);
    const expected = ["Example document with a single sentence", "Example document with multiple sentences. And punctuation"];
    expect(result).toEqual(expected);
  });

  it('should not find documents for partially matching words', async () => {
    const words = ["ex", "do", "se"];
    const result = await getInstance().findWithWords(words);
    const expected: string[] = [];
    expect(result).toEqual(expected);
  });
}

describe('SearchIndex: In-Memory E2E', () => {
  let si: SearchIndex;

  beforeAll(async () => {
    si = SearchIndex(InMemoryDocumentStore(), InMemoryInvertedIndex());
    await si.addDocumentsStream(Readable.from([
      "Example document with a single sentence",
      "Example document with multiple sentences. And punctuation",
      "",
    ]));
  });

  baseTests(() => si);
});

describe('SearchIndex: Redis and MongoDB stores E2E', () => {
  let si: SearchIndex;
  let redisClient: RedisClientType;
  let mongoClient: MongoClient;

  beforeAll(async () => {
    redisClient = createClient();
    redisClient.on('error', err => console.log(err));
    await redisClient.connect();

    mongoClient = new MongoClient('mongodb://localhost:27017');
    await mongoClient.connect();
    const mongoCollection = mongoClient.db("test").collection("documents");
    const documentStore = MongoDocumentStore(mongoCollection);
    const documentIndex = RedisInvertedIndex(redisClient);

    si = SearchIndex(documentStore, documentIndex);
    await si.addDocumentsStream(Readable.from([
      "Example document with a single sentence",
      "Example document with multiple sentences. And punctuation",
      "",
    ]));
  });

  afterAll(async () => {
    await redisClient.quit();
    await mongoClient.close();
  });

  baseTests(() => si);
});
