import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Sheet = {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    data: Buffer;
};
export type DB = {
    Sheet: Sheet;
};
