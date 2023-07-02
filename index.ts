import { Transform } from 'stream';
import { ObjectId, Collection } from 'mongodb';
import { RedisClientType } from 'redis';

export type SearchIndex = {
  addDocument: (document: string) => Promise<void>
  addDocuments: (documents: string[]) => Promise<void>
  addDocumentsStream: (stream: NodeJS.ReadableStream) => Promise<void>
  findWithWords: (words: string[]) => Promise<string[]>
}

export type DocumentStore = {
  storeDocument: (document: string) => Promise<DocumentId>
  getDocuments: (ids: DocumentId[]) => Promise<string[]>
}

export type InvertedDocumentIndex = {
  add: (word: string, documentId: DocumentId) => Promise<void>
  get: (word: string) => Promise<DocumentId[]>
  getIntersection: (words: string[]) => Promise<DocumentId[]>
}

export type DocumentId = string;

export const SearchIndex = (
  store: DocumentStore, 
  index: InvertedDocumentIndex
): SearchIndex => {

  const addDocument = async (document: string): Promise<void> => {
    const id = await store.storeDocument(document);
    const words = document.match(wordMatchingRegex) || [];
    words.forEach(async w => { await index.add(normalizeWord(w), id) })
  }

  const addDocuments = async (documents: string[]): Promise<void> => {
    documents.forEach(async (doc) => { await addDocument(doc) })
  }

  const addDocumentsStream = async (stream: NodeJS.ReadableStream): Promise<void> => {
    const transform = new Transform({
      readableObjectMode: true,
      writableObjectMode: true,
      transform: async (doc, encoding, callback) => {
        await addDocument(doc);
        callback(null, doc);
      }
    });

    return new Promise((resolve, reject) => {
      stream
        .pipe(transform)
        .on('error', reject)
        .on('finish', resolve);
    });
  }

  const findWithWords = async (words: string[]): Promise<string[]> => {
    const normalized = words.map(w => normalizeWord(w));
    let docsMatched = await index.getIntersection(normalized);

    return store.getDocuments(docsMatched)
  }
  
  // src: https://stackoverflow.com/a/36508315
  const wordMatchingRegex = /\b(\w+)\b/g;
  const normalizeWord = (word: string) => word.toLowerCase();

  return {
    addDocument,
    addDocuments,
    addDocumentsStream,
    findWithWords
  }
}

export const InMemoryDocumentStore = (): DocumentStore => {
  const store: { [id: string]: string } = {};

  return {
    storeDocument: async (document: string): Promise<DocumentId> => {
      const id = String(Object.keys(store).length);
      store[id] = document;
      return id;
    },
    getDocuments: async (ids: DocumentId[]): Promise<string[]> => {
      return ids.map(id => store[id]);
    }
  }
}

export const InMemoryInvertedIndex = (): InvertedDocumentIndex => {
  const index: { [word: string]: Set<DocumentId> } = {};

  return {
    add: async (word: string, documentId: DocumentId) => {
      if (index[word] === undefined) {
        index[word] = new Set();
      }
      index[word].add(documentId);
    },
    get: async (word: string): Promise<DocumentId[]> => {
      return [...index[word]];
    },
    getIntersection: async (words: string[]): Promise<DocumentId[]> => {
      if (words.length === 0) { return [] };

      if (index[words[0]] === undefined) { return [] };

      let intersection: DocumentId[] = [...index[words[0]]];

      words.forEach(w => {
        intersection = intersection.filter(doc => index[w]?.has(doc));
      });

      return intersection;
    }
  }
}

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

export const RedisInvertedIndex = (
  redisClient: RedisClientType, namespace: string = "minisearchindex"
): InvertedDocumentIndex => {
  
  const toKey = (word: string) => `${namespace}:word:${word}`;

  return {
    add: async (word: string, documentId: DocumentId): Promise<void> => {
      await redisClient.sAdd(toKey(word), documentId);
    },
    get: async (word: string): Promise<DocumentId[]> => {
      return await redisClient.sMembers(toKey(word));
    },
    getIntersection: async (words: string[]): Promise<DocumentId[]> => {
      if (words.length === 0) { return []; }
      return await redisClient.sInter(words.map(w => toKey(w)));
    }
  }
}