import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type Session = {
    id: string;
    expires_at: number;
    user_id: string;
};
export type Sheet = {
    id: string;
    name: string;
    created_at: string;
    opened_at: string | null;
    updated_at: string;
    deleted_at: string | null;
    data: string;
};
export type User = {
    id: string;
    username: string;
    password: string;
    created_at: string;
};
export type DB = {
    Session: Session;
    Sheet: Sheet;
    User: User;
};
