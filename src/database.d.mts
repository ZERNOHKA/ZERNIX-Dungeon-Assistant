export interface MockLootRow {
  readonly name: string;
  readonly description: string;
}

export declare const LOOT_DATASET: readonly MockLootRow[];

export declare function generateLootAsync(): Promise<MockLootRow>;

export declare function generateNpcAsync(): Promise<void>;

export declare function generateSessionAsync(): Promise<void>;
