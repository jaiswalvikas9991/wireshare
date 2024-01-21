import Dexie, { type Table } from 'dexie';


// name is the uuid
export interface SentFileType {
	name: string;
	size: number;
	type: string;
	completed: boolean;
	whenCompleted: number;
	file: File;
}


// name is the uuid
export interface ReceivedFileType {
	name: string;
	size: number;
	type: string;
	completed: boolean;
	whenCompleted: number;
	chunks: Blob[];
}

class DexieDatabase extends Dexie {
	public sentFilesCollection!: Table<SentFileType, string>;
	public receivedFilesCollection!: Table<ReceivedFileType, string>;
	public static DB_NAME = 'WireShare';

	public constructor() {
		super(DexieDatabase.DB_NAME);
		this.version(1).stores({
			sentFilesCollection: 'name,size,type,completed,whenCompleted,fileObj',
			receivedFilesCollection: 'name,size,type,completed,whenCompleted,chunks'
		});
	}
}

export class LocalStorage {
	db: DexieDatabase;
	constructor() {
		this.db = new DexieDatabase();
	}
	async getSentFileInfoBy(name: string): Promise<SentFileType> {
		const data = await this.db.sentFilesCollection.where('name').equals(name).toArray();
		if (data.length === 0) throw new Error('Data for name ' + name + ' is empty');
		if (data.length !== 1) throw new Error('Unique key volition for name ' + name);
		return data[0];
	}
	async getReceivedFileInfoBy(name: string): Promise<ReceivedFileType> {
		const data = await this.db.receivedFilesCollection.where('name').equals(name).toArray();
		if (data.length === 0) throw new Error('Data for name ' + name + ' is empty');
		if (data.length !== 1) throw new Error('Unique key volition for name ' + name);
		return data[0];
	}
	async getAllReceivedFileSplitsAsBlob(name: string): Promise<Blob | never> {
		const data = await this.db.receivedFilesCollection.where('name').equals(name).toArray();
		if (data.length != 1) throw new Error(`Provided name has inconsistent data: ${name}`);
		if (data[0].chunks.length === 0) throw new Error(`File with name ${name} has not chunks`);
		return new Blob(data[0].chunks);
	}
	async doesSentFileExists(name: string): Promise<boolean> {
		return (await this.db.sentFilesCollection.where('name').equals(name).count()) !== 0;
	}
	async doesReceivedFileExists(name: string): Promise<boolean> {
		return (await this.db.receivedFilesCollection.where('name').equals(name).count()) !== 0;
	}
	async insertSentFile(data: SentFileType): Promise<unknown> {
		return await this.db.sentFilesCollection.add(data);
	}
	async insertReceivedFile(data: ReceivedFileType): Promise<unknown> {
		return await this.db.receivedFilesCollection.add(data);
	}
	async getAllSplitsBy(name: string): Promise<Blob[]> {
		const data = await this.db.receivedFilesCollection.where('name').equals(name).toArray();
		if (data.length === 0) throw new Error('Data for name ' + name + ' is empty');
		if (data.length !== 1) throw new Error('Unique key volition for name ' + name);
		return data[0].chunks;
	}
	async getAllSentFiles(): Promise<SentFileType[] | never> {
		return await this.db.sentFilesCollection.toArray();
	}
	async getAllReceivedFiles(): Promise<ReceivedFileType[] | never> {
		return await this.db.receivedFilesCollection.toArray();
	}
	async addSplitToReceivedFileInfo(name: string, blob: Blob): Promise<unknown | never> {
		const curSplits = await this.getAllSplitsBy(name);
		return await this.db.receivedFilesCollection.update(name, { chunks: [...curSplits, blob] });
	}
	async markSentFileCompleted(name: string): Promise<unknown> {
		return await this.db.sentFilesCollection.update(name, { completed: true });
	}
	async markReceivedFileCompleted(name: string): Promise<unknown> {
		return await this.db.receivedFilesCollection.update(name, { completed: true });
	}
	async deleteSendingFileBy(name: string): Promise<unknown | never> {
		return await this.db.sentFilesCollection.where('name').equals(name).delete();
	}
	async deleteReceivingFileBy(name: string): Promise<unknown | never> {
		return await this.db.receivedFilesCollection.where('name').equals(name).delete();
	}
}

